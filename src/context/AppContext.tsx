// Single application context. Per the project's "keep it simple" mandate we
// use one React context + useReducer-free plain state instead of Redux /
// Zustand / TanStack Query — this is a personal app with a handful of
// screens, and a single provider is easy for a beginner to follow.
//
// This context is the ONLY place that talks to db/repository.ts. Components
// read state from here and call the exposed action functions; they never
// touch IndexedDB directly.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Commitment, DayRecord, ExportPayload, Settings, TimerState } from '../types';
import * as repo from '../db/repository';
import { todayISO } from '../utils/date';
import { reconcileReminders, startReminderLoop, type ReminderState } from '../utils/reminderScheduler';
import {
  applyAutoCompleteToRecord,
  applyPauseToRecord,
  applyStopToRecord,
  assertCanStartSession,
  hasReachedTarget,
  pauseSession,
  resumeSession,
  startSession,
  toggleHabitDayCompletion,
} from '../domain/habit';

interface AppContextValue {
  loading: boolean;
  error: string | null;
  dismissError: () => void;

  commitments: Commitment[];
  dayRecords: DayRecord[];
  timer: TimerState | null;
  settings: Settings;

  createCommitment: (input: repo.NewCommitmentInput) => Promise<Commitment>;
  deleteCommitment: (id: string) => Promise<void>;

  dayRecordsFor: (commitmentId: string) => DayRecord[];
  dayRecordFor: (commitmentId: string, date: string) => DayRecord | undefined;

  startTimer: (commitmentId: string) => Promise<void>;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  stopTimer: () => Promise<void>;

  /** Toggles a Completion-type commitment's today record between DONE and
   *  NOT_STARTED. No timer is ever involved for these commitments. */
  toggleTodayCompletion: (commitmentId: string) => Promise<void>;

  updateSettings: (partial: Partial<Settings>) => Promise<void>;
  exportData: () => Promise<ExportPayload>;
  importData: (payload: unknown) => Promise<void>;
  resetAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

/**
 * Split out from AppContextValue on purpose. `nowMs` advances every second
 * while a timer is running, and only Today/Timer screens actually read it
 * for live elapsed-time math. If it lived on the main context value, its
 * every-second update would force every useApp() consumer to re-render
 * (Layout, Commitments, Progress, Settings, ...) even while just scrolling
 * a screen that has nothing to do with the timer. A separate context means
 * only components that call useNowMs() re-render on each tick.
 */
const NowMsContext = createContext<number>(0);

/**
 * Also split out on purpose, same rationale as NowMsContext: `settings`
 * changes far less often than `commitments`/`dayRecords`/`timer` (a couple
 * of taps on the Settings screen, ever), but living on the main context
 * value meant EVERY app state change — saving a day record, starting a
 * timer, completing a habit — forced a re-render on any component that
 * merely reads `settings` for something unrelated to that change (the
 * Settings screen itself; App's onboarding route guard). A dedicated
 * context means those consumers only re-render when settings actually
 * changes. Components that already need other AppContext fields alongside
 * settings (e.g. Layout, which needs timer + commitments too) keep reading
 * settings via useApp() as before — splitting wouldn't reduce their
 * re-renders anyway, since they depend on the frequently-changing fields
 * regardless.
 */
interface SettingsContextValue {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
}
const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function useNowMs(): number {
  return useContext(NowMsContext);
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [dayRecords, setDayRecords] = useState<DayRecord[]>([]);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [settings, setSettings] = useState<Settings>(repo.DEFAULT_SETTINGS);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const dayRecordsRef = useRef(dayRecords);
  dayRecordsRef.current = dayRecords;
  const timerRef = useRef(timer);
  timerRef.current = timer;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const commitmentsRef = useRef(commitments);
  commitmentsRef.current = commitments;

  // Latest reminder-relevant state, read on demand by the reminder loop so
  // it never operates on stale data captured in a closure.
  const reminderState = useCallback(
    (): ReminderState => ({
      commitments: commitmentsRef.current,
      dayRecords: dayRecordsRef.current,
      timer: timerRef.current,
      settings: settingsRef.current,
    }),
    [],
  );

  const reportError = useCallback((err: unknown, fallback: string) => {
    console.error(err);
    setError(err instanceof Error ? err.message : fallback);
  }, []);

  // ---------- initial load ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [loadedCommitments, loadedRecords, loadedTimer, loadedSettings] = await Promise.all([
          repo.listCommitments(),
          repo.listAllDayRecords(),
          repo.getTimerState(),
          repo.getSettings(),
        ]);
        if (cancelled) return;
        setCommitments(loadedCommitments);
        setDayRecords(loadedRecords);
        setTimer(loadedTimer ?? null);
        setSettings(loadedSettings);
      } catch (err) {
        if (!cancelled) reportError(err, 'Failed to load your data. Please refresh the page.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reportError]);

  // ---------- smart reminders ----------
  // Re-reconcile whenever anything a reminder depends on changes (or after
  // the initial load completes). On native this re-schedules OS
  // notifications from current state (so completed/edited commitments stop
  // reminding and nothing duplicates); on web it fires any due reminder
  // while the app is open. All gated on the user's reminder settings +
  // real permission inside the scheduler.
  useEffect(() => {
    if (loading) return;
    reconcileReminders({ commitments, dayRecords, timer, settings });
  }, [loading, commitments, dayRecords, timer, settings]);

  // Background driver: web foreground interval + native app-resume re-sync.
  // Mounted once; reads fresh state on demand via reminderState().
  useEffect(() => {
    const stop = startReminderLoop(reminderState);
    return stop;
  }, [reminderState]);

  // ---------- theme reflected on <html> ----------
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    // Mirrored into localStorage under the same key index.html's inline
    // script reads synchronously before first paint — purely so a
    // returning user's actual saved theme (light or dark) can be applied
    // immediately on the next load, instead of flashing the default Deep
    // theme for a moment while IndexedDB loads asynchronously. Best-effort
    // only: if storage is unavailable, the app still works correctly, it
    // just briefly shows the default theme before this effect runs.
    try {
      window.localStorage.setItem('grit_theme_cache', settings.theme);
    } catch {
      // Storage unavailable (private browsing, quota) — safe to ignore.
    }
  }, [settings.theme]);

  // ---------- ticking clock while a timer runs, + auto-complete ----------
  useEffect(() => {
    if (!timer || timer.status !== 'running') return;

    const interval = setInterval(async () => {
      const currentTimer = timerRef.current;
      if (!currentTimer || currentTimer.status !== 'running') return;

      const now = Date.now();
      setNowMs(now);

      const record = dayRecordsRef.current.find(
        (r) => r.commitmentId === currentTimer.commitmentId && r.date === currentTimer.dayDate,
      );
      if (!record) return;

      if (hasReachedTarget(currentTimer, record, now)) {
        await completeFromTimer(currentTimer, record, now);
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer?.status, timer?.commitmentId, timer?.dayDate]);

  async function completeFromTimer(currentTimer: TimerState, record: DayRecord, now: number) {
    const updated = applyAutoCompleteToRecord(currentTimer, record, now);
    await repo.saveDayRecord(updated);
    await repo.clearTimerState();
    setDayRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setTimer(null);
  }

  // ---------- commitments ----------
  const createCommitment = useCallback(async (input: repo.NewCommitmentInput) => {
    const commitment = await repo.createCommitment(input);
    const records = await repo.listDayRecordsForCommitment(commitment.id);
    setCommitments((prev) => [commitment, ...prev]);
    setDayRecords((prev) => [...prev, ...records]);
    return commitment;
  }, []);

  const deleteCommitment = useCallback(async (id: string) => {
    await repo.deleteCommitment(id);
    setCommitments((prev) => prev.filter((c) => c.id !== id));
    setDayRecords((prev) => prev.filter((r) => r.commitmentId !== id));
    setTimer((prev) => {
      if (prev && prev.commitmentId === id) {
        repo.clearTimerState().catch(() => undefined);
        return null;
      }
      return prev;
    });
  }, []);

  const dayRecordsFor = useCallback(
    (commitmentId: string) => dayRecords.filter((r) => r.commitmentId === commitmentId).sort((a, b) => a.date.localeCompare(b.date)),
    [dayRecords],
  );

  const dayRecordFor = useCallback(
    (commitmentId: string, date: string) => dayRecords.find((r) => r.commitmentId === commitmentId && r.date === date),
    [dayRecords],
  );

  // ---------- timer ----------
  // Every method here is a thin persistence/state wrapper around the pure
  // functions in domain/habit/timerSession.ts — this context decides WHEN
  // to call them and how to save/broadcast the result; it doesn't compute
  // the timer/record math itself anymore.
  const startTimer = useCallback(
    async (commitmentId: string) => {
      const date = todayISO(settingsRef.current.dailyResetHour);
      const record = dayRecordsRef.current.find((r) => r.commitmentId === commitmentId && r.date === date);
      assertCanStartSession(timerRef.current, record);

      const newTimer = startSession(commitmentId, date, record!.elapsedSeconds, Date.now());
      await repo.saveTimerState(newTimer);
      setTimer(newTimer);
      setNowMs(Date.now());
    },
    [],
  );

  const pauseTimer = useCallback(async () => {
    const current = timerRef.current;
    if (!current || current.status !== 'running' || current.runStartedAt == null) return;
    const now = Date.now();
    const updated = pauseSession(current, now);
    await repo.saveTimerState(updated);

    const record = dayRecordsRef.current.find(
      (r) => r.commitmentId === updated.commitmentId && r.date === updated.dayDate,
    );
    if (record) {
      const updatedRecord = applyPauseToRecord(updated, record, now);
      await repo.saveDayRecord(updatedRecord);
      setDayRecords((prev) => prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r)));
    }

    setTimer(updated);
    setNowMs(now);
  }, []);

  const resumeTimer = useCallback(async () => {
    const current = timerRef.current;
    if (!current || current.status !== 'paused') return;
    const updated = resumeSession(current, Date.now());
    await repo.saveTimerState(updated);
    setTimer(updated);
    setNowMs(Date.now());
  }, []);

  const stopTimer = useCallback(async () => {
    const current = timerRef.current;
    if (!current) return;
    const now = Date.now();
    const record = dayRecordsRef.current.find(
      (r) => r.commitmentId === current.commitmentId && r.date === current.dayDate,
    );
    if (record) {
      const updatedRecord = applyStopToRecord(current, record, now);
      await repo.saveDayRecord(updatedRecord);
      setDayRecords((prev) => prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r)));
    }
    await repo.clearTimerState();
    setTimer(null);
    setNowMs(now);
  }, []);

  // ---------- completion-only habits (no timer involved) ----------
  const toggleTodayCompletion = useCallback(async (commitmentId: string) => {
    const date = todayISO(settingsRef.current.dailyResetHour);
    const record = dayRecordsRef.current.find((r) => r.commitmentId === commitmentId && r.date === date);
    if (!record) {
      throw new Error('This commitment has no scheduled day for today.');
    }
    const updated = toggleHabitDayCompletion(record);
    await repo.saveDayRecord(updated);
    setDayRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }, []);

  // ---------- settings ----------
  const updateSettings = useCallback(async (partial: Partial<Settings>) => {
    const updated: Settings = { ...settings, ...partial };
    await repo.saveSettings(updated);
    setSettings(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  // ---------- export / import / reset ----------
  const exportData = useCallback(() => repo.exportAllData(), []);

  const importData = useCallback(async (payload: unknown) => {
    await repo.importAllData(payload);
    const [loadedCommitments, loadedRecords, loadedTimer, loadedSettings] = await Promise.all([
      repo.listCommitments(),
      repo.listAllDayRecords(),
      repo.getTimerState(),
      repo.getSettings(),
    ]);
    setCommitments(loadedCommitments);
    setDayRecords(loadedRecords);
    setTimer(loadedTimer ?? null);
    setSettings(loadedSettings);
  }, []);

  const resetAllData = useCallback(async () => {
    await repo.resetAllData();
    setCommitments([]);
    setDayRecords([]);
    setTimer(null);
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  const value = useMemo<AppContextValue>(
    () => ({
      loading,
      error,
      dismissError,
      commitments,
      dayRecords,
      timer,
      settings,
      createCommitment,
      deleteCommitment,
      dayRecordsFor,
      dayRecordFor,
      startTimer,
      pauseTimer,
      resumeTimer,
      stopTimer,
      toggleTodayCompletion,
      updateSettings,
      exportData,
      importData,
      resetAllData,
    }),
    [
      loading,
      error,
      dismissError,
      commitments,
      dayRecords,
      timer,
      settings,
      createCommitment,
      deleteCommitment,
      dayRecordsFor,
      dayRecordFor,
      startTimer,
      pauseTimer,
      resumeTimer,
      stopTimer,
      toggleTodayCompletion,
      updateSettings,
      exportData,
      importData,
      resetAllData,
    ],
  );

  const settingsValue = useMemo<SettingsContextValue>(
    () => ({ settings, updateSettings }),
    [settings, updateSettings],
  );

  return (
    <AppContext.Provider value={value}>
      <SettingsContext.Provider value={settingsValue}>
        <NowMsContext.Provider value={nowMs}>{children}</NowMsContext.Provider>
      </SettingsContext.Provider>
    </AppContext.Provider>
  );
}

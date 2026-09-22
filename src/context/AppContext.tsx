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
import { playAlertTune } from '../utils/alertSound';
import { supportsVibration } from '../utils/notificationCapabilities';
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

  /** Starts a timer for `commitmentId` on the given `date` (default: today).
   *  Passing an explicit past date is how the Today screen's "Yesterday
   *  leftover" section resumes an incomplete day — the resulting session
   *  writes back into THAT date's record, and its later DONE is flagged
   *  COMPLETED_LATE by history since completedAt lies on a later day. */
  startTimer: (commitmentId: string, date?: string) => Promise<void>;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  stopTimer: () => Promise<void>;

  /** Toggles a Completion-type commitment's record for `date` (default:
   *  today) between DONE and NOT_STARTED. No timer is ever involved for
   *  these commitments. The `date` parameter lets the Today screen's
   *  "Yesterday leftover" section mark a missed completion habit as
   *  DONE — completedAt is stamped `now`, so history derives
   *  COMPLETED_LATE for it. */
  toggleDayCompletion: (commitmentId: string, date?: string) => Promise<void>;

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

/**
 * Fires the timer-completion feedback — the tune and/or a haptic buzz —
 * gated on the user's existing Sound and Vibration toggles from the
 * Reminders section of Settings. They're reused deliberately: the user
 * asked for a single "ring or vibrate" preference that applies both to
 * scheduled reminders and to timer completions, rather than two parallel
 * sets of toggles to keep in sync.
 *
 * Called from both the auto-complete path and the manual-stop-at-target
 * path in AppContext; kept as a module-level helper so both call sites
 * can't drift out of sync. Reads live from a settings snapshot rather
 * than closing over React state — callers pass settingsRef.current so
 * the event fires with whatever the user has toggled right now, not
 * what was captured when the interval/handler was set up.
 */
function fireCompletionFeedback(settings: Settings): void {
  if (settings.reminderSound) {
    playAlertTune();
  }
  // 220ms is long enough to feel deliberate ("completed!") without buzzing
  // the phone off a desk — mirrors the reminder-vibration value used in
  // reminderScheduler's web fire path, keeping the whole app's haptic
  // vocabulary consistent.
  if (settings.reminderVibration && supportsVibration()) {
    navigator.vibrate(220);
  }
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
        const [loadedCommitments, loadedRecords, loadedTimerRaw, loadedSettings] = await Promise.all([
          repo.listCommitments(),
          repo.listAllDayRecords(),
          repo.getTimerState(),
          repo.getSettings(),
        ]);
        if (cancelled) return;

        // Release a stale timer left over from a previous logical day.
        //
        // The TimerState singleton is persisted with the specific calendar
        // date the session belongs to (`dayDate`). If the user closes the
        // app mid-session and re-opens it after the daily-refresh boundary
        // has rolled over — or simply the next morning — that TimerState
        // still points to yesterday. Without releasing it here, the whole
        // Today screen sees `!!timer === true`, every card's
        // `isTimedHere` is false (dayDate mismatches today), and every
        // Start button greys out under `anotherTimerRunning`. The auto-
        // complete interval eventually cleans this up IFF the accumulated
        // elapsed exceeds the target, but that isn't guaranteed — and it
        // still leaves a visible "why is Start disabled" window at every
        // launch.
        //
        // Data policy: we do NOT modify yesterday's day record here.
        // Anything already persisted via pauses/stops is untouched; only
        // the unsaved running-since-last-pause slice is dropped (which is
        // inherent to any timer left running when the app closes). This
        // keeps the fix purely "release the lock, keep the history",
        // matching the user's "no data loss" mandate.
        let loadedTimer: TimerState | null | undefined = loadedTimerRaw;
        const todayLocal = todayISO(loadedSettings.dailyResetHour);
        if (loadedTimer && loadedTimer.dayDate < todayLocal) {
          try {
            await repo.clearTimerState();
          } catch {
            // Best-effort: if the clear fails (very rare), we still fall
            // through and set loadedTimer=null in memory so the current
            // session is unblocked; the next app open will retry the
            // clear.
          }
          loadedTimer = null;
        }

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
    // Celebratory tune + haptic — target was just reached automatically
    // while the timer ticked. Never fires for pauses/stops-before-target,
    // and never for COMPLETION habits (they never enter this code path).
    // Each channel is user-gated via its own Settings toggle so someone
    // who wants "silent but buzzed" or "sound only, no buzz" can have it.
    fireCompletionFeedback(settingsRef.current);
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
    async (commitmentId: string, date?: string) => {
      // `date` defaults to today (the original single-argument behavior).
      // Passing an explicit past date is what the "Yesterday leftover"
      // section uses to resume/complete a missed day — the session's
      // dayDate is bound to that past date, so its elapsed accrues onto
      // that record and later marks it DONE with completedAt = today
      // (which derives as COMPLETED_LATE in history).
      const targetDate = date ?? todayISO(settingsRef.current.dailyResetHour);
      const record = dayRecordsRef.current.find((r) => r.commitmentId === commitmentId && r.date === targetDate);
      assertCanStartSession(timerRef.current, record);

      const newTimer = startSession(commitmentId, targetDate, record!.elapsedSeconds, Date.now());
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
    let reachedTargetThisStop = false;
    if (record) {
      const updatedRecord = applyStopToRecord(current, record, now);
      await repo.saveDayRecord(updatedRecord);
      setDayRecords((prev) => prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r)));
      // Only fire the tune if this Stop is the moment the day became DONE.
      // assertCanStartSession already blocks starting a timer on an
      // already-DONE record, so `record.status !== 'DONE'` should always
      // hold here — but we check anyway so a stray future code path that
      // starts a session on a DONE record can't double-fire the sound.
      reachedTargetThisStop = record.status !== 'DONE' && updatedRecord.status === 'DONE';
    }
    await repo.clearTimerState();
    setTimer(null);
    setNowMs(now);
    if (reachedTargetThisStop) {
      // Manual-stop-at-target counterpart of the auto-complete feedback in
      // completeFromTimer — user chose to Stop right as/after the target
      // was reached, and the record transitioned to DONE this call. Same
      // Settings-gated ring + buzz behavior.
      fireCompletionFeedback(settingsRef.current);
    }
  }, []);

  // ---------- completion-only habits (no timer involved) ----------
  const toggleDayCompletion = useCallback(async (commitmentId: string, date?: string) => {
    // `date` defaults to today. The Today screen's "Yesterday leftover"
    // section passes an explicit past date to check off a missed
    // completion habit; toggleHabitDayCompletion stamps completedAt = now,
    // which history then derives as COMPLETED_LATE (since completedAt's
    // calendar day > record.date).
    const targetDate = date ?? todayISO(settingsRef.current.dailyResetHour);
    const record = dayRecordsRef.current.find((r) => r.commitmentId === commitmentId && r.date === targetDate);
    if (!record) {
      throw new Error('This commitment has no scheduled day for that date.');
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
      toggleDayCompletion,
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
      toggleDayCompletion,
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

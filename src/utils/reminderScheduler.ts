// Smart Reminder dispatch. Turns the pure decisions from
// domain/habit/reminders.ts into real notifications, on two platforms:
//
//   - Native Android (Capacitor): schedules OS local notifications ahead of
//     time at the user's chosen frequency, so reminders arrive even when the
//     app isn't foregrounded. Every reconcile cancels the previously
//     scheduled batch and re-schedules from current state — this is how we
//     guarantee "never remind a completed commitment" and "no duplicates":
//     completed/edited/finished commitments simply aren't re-scheduled. The
//     content is computed at schedule time; re-reconciling on every app
//     open/resume/state-change keeps it fresh.
//
//   - Web / PWA: browsers can't deliver background notifications without a
//     push server (which would mean cloud — explicitly out of scope), so on
//     web reminders fire only while the app is open, via a foreground tick.
//
// Everything is gated on the user's existing reminder settings + real
// notification permission. Nothing here talks to the network.

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Commitment, DayRecord, Settings, TimerState } from '../types';
import { todayISO } from './date';
import { computeReminder, type SmartReminder } from '../domain/habit/reminders';
import { getNotificationPermission, supportsVibration } from './notificationCapabilities';

export interface ReminderState {
  commitments: Commitment[];
  dayRecords: DayRecord[];
  timer: TimerState | null;
  settings: Settings;
}

const FREQ_HOURS: Record<Settings['reminderFrequency'], number> = {
  EVERY_1H: 1,
  EVERY_2H: 2,
  EVERY_3H: 3,
  EVERY_4H: 4,
  EVERY_5H: 5,
};

/** Cap on how many future reminders to queue per commitment per day, so even
 *  "Every 1 hour" never becomes a wall of notifications. */
const MAX_OCCURRENCES = 6;

const SCHEDULED_IDS_KEY = 'grit_scheduled_reminder_ids';
const WEB_LAST_FIRED_KEY = 'grit_web_reminder_last';

const isNative = (): boolean => Capacitor.isNativePlatform();

/** Stable positive integer base id for a commitment (LocalNotifications
 *  requires numeric ids). Occurrences add a small offset on top. */
function baseIdFor(commitmentId: string): number {
  let hash = 0;
  for (let i = 0; i < commitmentId.length; i++) {
    hash = (hash * 31 + commitmentId.charCodeAt(i)) % 100_000;
  }
  return hash * 10; // leaves room for +0..+9 occurrence offsets
}

/** The active-today reminders for the current state (one per incomplete,
 *  active, non-timed commitment scheduled today). Shared by both platforms. */
export function activeReminders(state: ReminderState): SmartReminder[] {
  const { commitments, dayRecords, timer, settings } = state;
  if (!settings.notificationsEnabled) return [];
  const today = todayISO(settings.dailyResetHour);
  const out: SmartReminder[] = [];
  for (const commitment of commitments) {
    if (!(commitment.startDate <= today && today <= commitment.endDate)) continue;
    const record = dayRecords.find((r) => r.commitmentId === commitment.id && r.date === today);
    if (!record) continue;
    const isTimedNow = !!timer && timer.commitmentId === commitment.id && timer.dayDate === today;
    const reminder = computeReminder(commitment, record, today, settings.dailyResetHour, isTimedNow);
    if (reminder) out.push(reminder);
  }
  return out;
}

// ---------------- Native scheduling ----------------

function readScheduledIds(): number[] {
  try {
    const raw = window.localStorage.getItem(SCHEDULED_IDS_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

function writeScheduledIds(ids: number[]): void {
  try {
    window.localStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage failures — worst case we over-cancel next reconcile.
  }
}

async function cancelPreviouslyScheduled(): Promise<void> {
  const ids = readScheduledIds();
  if (ids.length === 0) return;
  try {
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch {
    // Ignore — the ids may already be gone.
  }
  writeScheduledIds([]);
}

/** Local time of the next daily roll-over boundary (honoring resetHour). */
function nextResetTime(now: Date, resetHour: number): Date {
  const d = new Date(now);
  d.setHours(resetHour, 0, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

async function syncNativeReminders(state: ReminderState, now: number): Promise<void> {
  await cancelPreviouslyScheduled();

  if (!state.settings.notificationsEnabled) return;
  const permission = await getNotificationPermission();
  if (permission !== 'granted') return;

  const reminders = activeReminders(state);
  if (reminders.length === 0) return;

  const intervalMs = FREQ_HOURS[state.settings.reminderFrequency] * 3_600_000;
  const nowDate = new Date(now);
  const boundary = nextResetTime(nowDate, state.settings.dailyResetHour).getTime();
  // How many interval steps fit before the day rolls over.
  const stepsUntilBoundary = Math.floor((boundary - now) / intervalMs);
  const occurrences = Math.max(0, Math.min(MAX_OCCURRENCES, stepsUntilBoundary));
  if (occurrences === 0) return;

  const scheduled: number[] = [];
  const notifications = [];
  for (const reminder of reminders) {
    const base = baseIdFor(reminder.commitmentId);
    for (let k = 1; k <= occurrences; k++) {
      const id = base + (k - 1);
      scheduled.push(id);
      notifications.push({
        id,
        title: reminder.title,
        body: reminder.body,
        schedule: { at: new Date(now + k * intervalMs) },
        // Deep-link target so tapping opens the right screen.
        extra: { commitmentId: reminder.commitmentId, action: reminder.actionLabel },
      });
    }
  }

  try {
    await LocalNotifications.schedule({ notifications });
    writeScheduledIds(scheduled);
  } catch {
    // Scheduling can fail if permission was revoked mid-flight — ignore.
  }
}

// ---------------- Web foreground firing ----------------

function readWebLastFired(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(WEB_LAST_FIRED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function writeWebLastFired(map: Record<string, number>): void {
  try {
    window.localStorage.setItem(WEB_LAST_FIRED_KEY, JSON.stringify(map));
  } catch {
    // Ignore.
  }
}

/**
 * Fires any due reminders while the app is open (web only). Uses a per-
 * commitment last-fired timestamp so a reminder repeats at the chosen
 * frequency and never fires more often. On first sight of a commitment the
 * timestamp is seeded to `now`, so the first reminder arrives one full
 * interval later ("every hour beginning from when it's set").
 */
function tickWebReminders(state: ReminderState, now: number): void {
  if (!state.settings.notificationsEnabled) return;
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

  const intervalMs = FREQ_HOURS[state.settings.reminderFrequency] * 3_600_000;
  const reminders = activeReminders(state);
  const activeIds = new Set(reminders.map((r) => r.commitmentId));
  const lastFired = readWebLastFired();

  // Drop entries for commitments that are no longer active/incomplete.
  for (const id of Object.keys(lastFired)) {
    if (!activeIds.has(id)) delete lastFired[id];
  }

  for (const reminder of reminders) {
    const last = lastFired[reminder.commitmentId];
    if (last == null) {
      // First time seen this session — start the clock, don't fire yet.
      lastFired[reminder.commitmentId] = now;
      continue;
    }
    if (now - last >= intervalMs) {
      try {
        new Notification(reminder.title, {
          body: reminder.body,
          tag: `grit-reminder-${reminder.commitmentId}`,
          silent: !state.settings.reminderSound,
        });
        if (state.settings.reminderVibration && supportsVibration()) navigator.vibrate(200);
      } catch {
        // Ignore fire failures.
      }
      lastFired[reminder.commitmentId] = now;
    }
  }

  writeWebLastFired(lastFired);
}

// ---------------- Public entry points ----------------

/**
 * Compact "did anything a reminder cares about change?" signature.
 *
 * The context effect that calls reconcileReminders can fire on any app-
 * state change (new dayRecord after a tick, theme toggle, commitment
 * edit, ...), but MOST of those changes are irrelevant to the reminder
 * schedule itself — reminders only depend on: whether reminders are
 * enabled, the frequency + reset hour, and whether each active
 * commitment's TODAY record is still in an incomplete state. Comparing a
 * cheap signature before doing any real work skips the (expensive on
 * native — IPC round-trip to cancel + reschedule OS notifications, plus
 * localStorage reads) reconcile on the many state changes that don't
 * change what should fire.
 */
function reminderSignature(state: ReminderState): string {
  const { commitments, dayRecords, timer, settings } = state;
  if (!settings.notificationsEnabled) return 'off';
  const today = todayISO(settings.dailyResetHour);
  const timerKey = timer ? `${timer.commitmentId}:${timer.dayDate}:${timer.status}` : '-';
  const parts: string[] = [
    settings.reminderFrequency,
    String(settings.dailyResetHour),
    settings.reminderSound ? '1' : '0',
    settings.reminderVibration ? '1' : '0',
    timerKey,
  ];
  for (const commitment of commitments) {
    if (!(commitment.startDate <= today && today <= commitment.endDate)) continue;
    const record = dayRecords.find((r) => r.commitmentId === commitment.id && r.date === today);
    if (!record) continue;
    // Elapsed changes as a timer runs but doesn't affect WHICH reminders
    // are due — status + persisted elapsed>0 is enough to distinguish the
    // three states the reminder logic branches on.
    parts.push(
      `${commitment.id}|${commitment.endDate}|${record.status}|${record.elapsedSeconds > 0 ? '1' : '0'}`,
    );
  }
  return parts.join('~');
}

let pendingReconcileTimer: ReturnType<typeof setTimeout> | null = null;
let lastReconciledSignature: string | null = null;

/** Reconcile reminders against the latest state. Call on load and whenever
 *  commitments / records / timer / settings change. Fire-and-forget.
 *
 *  Coalesced: rapid bursts of calls (e.g. multiple setStates during initial
 *  load or a habit toggle) collapse into a single reconcile ~250ms later,
 *  and no work runs at all when the reminder-relevant signature hasn't
 *  actually changed since the last reconcile. */
export function reconcileReminders(state: ReminderState): void {
  const signature = reminderSignature(state);
  if (signature === lastReconciledSignature) return;
  if (pendingReconcileTimer != null) clearTimeout(pendingReconcileTimer);
  pendingReconcileTimer = setTimeout(() => {
    pendingReconcileTimer = null;
    lastReconciledSignature = signature;
    const now = Date.now();
    if (isNative()) {
      void syncNativeReminders(state, now);
    } else {
      tickWebReminders(state, now);
    }
  }, 250);
}

/**
 * Starts the background driver: a web foreground interval (fires due
 * reminders while the app is open) and, on native, a re-sync whenever the
 * app resumes. `getState` returns the current state on demand (so the loop
 * always sees fresh data). Returns a cleanup function.
 */
export function startReminderLoop(getState: () => ReminderState): () => void {
  const cleanups: Array<() => void> = [];

  if (isNative()) {
    // Re-schedule from fresh state each time the app comes back to the
    // foreground, so a completed/edited commitment stops reminding promptly.
    const handle = App.addListener('resume', () => {
      void syncNativeReminders(getState(), Date.now());
    });
    cleanups.push(() => void handle.then((h) => h.remove()));
  } else {
    // Web: check once a minute while the tab is open.
    const interval = window.setInterval(() => tickWebReminders(getState(), Date.now()), 60_000);
    cleanups.push(() => window.clearInterval(interval));
  }

  return () => cleanups.forEach((fn) => fn());
}

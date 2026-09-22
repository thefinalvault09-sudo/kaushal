// Core data models for GRIT.
// Kept intentionally small and flat — this is a personal-use app, not an
// enterprise system, so we avoid deep nesting or redundant derived fields
// wherever a value can be computed cheaply instead.

/**
 * How a commitment's daily progress is tracked:
 *  - DURATION: existing timer-based behavior (hours/minutes target).
 *  - COMPLETION: a simple Done/Not Done habit with no timer. Its
 *    `dailyTargetSeconds` is always 0 and is never used for math.
 * Optional on read for backward compatibility with commitments created
 * before this field existed — always treat a missing value as 'DURATION'.
 */
export type TrackingType = 'DURATION' | 'COMPLETION';

/** A single commitment the user has made to themselves. */
export interface Commitment {
  id: string;
  name: string;
  /** Daily target, stored in seconds for precise timer math.
   *  Always 0 for COMPLETION commitments. */
  dailyTargetSeconds: number;
  durationDays: number;
  /** Defaults to 'DURATION' when absent (pre-existing commitments). */
  trackingType?: TrackingType;
  /** ISO date string YYYY-MM-DD, local calendar day. */
  startDate: string;
  /** ISO date string YYYY-MM-DD, inclusive. startDate + durationDays - 1. */
  endDate: string;
  createdAt: number;
}

/**
 * The persisted, authoritative completion state of a day record.
 * Richer display states (IN_PROGRESS, MISSED, COMPLETED_LATE) are derived
 * at render time from this plus the scheduled date and any active timer —
 * see domain/status.ts. This keeps history append-only and avoids background
 * jobs that would need to "sweep" records to mark them MISSED.
 */
export type DayRecordStatus = 'NOT_STARTED' | 'PARTIAL' | 'DONE';

/** One scheduled day within a commitment's lifetime. */
export interface DayRecord {
  /** `${commitmentId}_${date}` */
  id: string;
  commitmentId: string;
  /** Scheduled calendar date, YYYY-MM-DD. Never moves once created. */
  date: string;
  targetSeconds: number;
  elapsedSeconds: number;
  status: DayRecordStatus;
  /** Epoch ms, set the moment elapsedSeconds first reaches targetSeconds. */
  completedAt?: number;
}

export type TimerStatus = 'running' | 'paused';

/**
 * Singleton active-timer record (id is always 'current').
 * Elapsed time is always derived from timestamps, never from a running
 * setInterval count, so it survives refresh/close/reopen intact.
 */
export interface TimerState {
  id: 'current';
  commitmentId: string;
  /** The scheduled day this session's time is attributed to. Fixed at start,
   *  even if the session runs past local midnight. */
  dayDate: string;
  status: TimerStatus;
  /** Seconds already recorded on the day record before this session began. */
  baselineSeconds: number;
  /** Seconds accumulated from completed run segments within this session. */
  accumulatedSeconds: number;
  /** Epoch ms when the current running segment began, or null if paused. */
  runStartedAt: number | null;
}

export type ThemeMode = 'dark' | 'light';

/** Gap between reminder notifications while reminders are enabled, as an
 *  hourly interval (1 to 5 hours). Purely a stored preference — see
 *  Settings.tsx for the capability-detection that governs what this
 *  actually does on the current platform/browser. */
export type ReminderFrequency = 'EVERY_1H' | 'EVERY_2H' | 'EVERY_3H' | 'EVERY_4H' | 'EVERY_5H';

export interface Settings {
  id: 'app';
  theme: ThemeMode;
  notificationsEnabled: boolean;
  hasOnboarded: boolean;
  /** Master reminder controls. `reminderSound`/`reminderVibration`/
   *  `reminderFullScreenAlert` are only ever honored when the current
   *  platform/browser actually supports the underlying capability — see
   *  the capability checks in Settings.tsx. Storing the preference here
   *  regardless means the choice is remembered if the app is later opened
   *  somewhere that DOES support it (e.g. moving from a plain browser tab
   *  to the packaged Android build). */
  reminderSound: boolean;
  reminderVibration: boolean;
  reminderFrequency: ReminderFrequency;
  /** Local hour (0-23) at which the app's "today" rolls over to the next
   *  calendar day. 0 = midnight (the original, unconfigurable behavior).
   *  Only ever affects which date counts as "today" for scheduling/live
   *  views going forward — never rewrites a DayRecord's already-stored
   *  `date`. */
  dailyResetHour: number;
}

/** Derived, presentation-only status used across Today/History/Progress. */
export type DisplayStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'PARTIAL'
  | 'DONE'
  | 'COMPLETED_LATE'
  | 'MISSED';

/** Shape of a full data export for backup/import. */
export interface ExportPayload {
  version: 1;
  exportedAt: string;
  commitments: Commitment[];
  dayRecords: DayRecord[];
  timerState: TimerState | null;
  settings: Settings | null;
}

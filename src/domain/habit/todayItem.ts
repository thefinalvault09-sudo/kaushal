// Derives everything a Today/Timer card needs to render from a Habit + its
// HabitDayRecord + the active timer (if any). Pure and framework-free so
// it can be unit tested and reused without a component tree. This is the
// composition point where the rest of the habit system comes together:
// duration tracking for DURATION habits, daily-completion state for
// COMPLETION habits, and history for the DisplayStatus every habit type
// shares.

import type { HabitDayRecord } from './model';
import type { TimerState, TrackingType } from '../../types';
import type { Habit } from './model';
import { computeDisplayStatus } from './history';
import { resolveTrackingType } from './trackingType';
import { computeDurationProgress } from './durationTracking';
import { cappedElapsedSeconds } from '../../timer/engine';

export interface TodayItem {
  commitment: Habit;
  trackingType: TrackingType;
  record: HabitDayRecord;
  status: ReturnType<typeof computeDisplayStatus>;
  liveElapsed: number;
  remaining: number;
  percent: number;
  isTimedHere: boolean;
}

/**
 * Builds a `TodayItem` for a single habit + its record for `date`.
 * `nowMs` drives live elapsed-time math while a timer is actively running
 * against this exact habit/day; otherwise the record's persisted
 * `elapsedSeconds` is used as-is. `nowMs` is passed in (rather than read
 * via `Date.now()` internally) so this stays a pure function of its inputs
 * — callers re-derive it whenever their own `nowMs` state ticks.
 */
export function deriveTodayItem(
  habit: Habit,
  record: HabitDayRecord,
  date: string,
  timer: TimerState | null | undefined,
  nowMs: number,
  /** The user's configured daily-reset hour (Settings > Daily refresh
   *  time), 0-23. Defaults to 0 (midnight). */
  dailyResetHour = 0,
): TodayItem {
  const trackingType = resolveTrackingType(habit);
  const isTimedHere = timer?.commitmentId === habit.id && timer.dayDate === date;
  const liveElapsed = isTimedHere && timer
    ? cappedElapsedSeconds(timer, record.targetSeconds, nowMs)
    : record.elapsedSeconds;

  // COMPLETION habits have a binary fill (0% or 100%, driven by the
  // persisted DONE status) rather than a proportional duration fill —
  // computeDurationProgress's remaining/percent math would divide by the
  // habit's always-0 targetSeconds, so it's only used for DURATION habits.
  const { percent, remainingSeconds } =
    trackingType === 'COMPLETION'
      ? { percent: record.status === 'DONE' ? 100 : 0, remainingSeconds: 0 }
      : computeDurationProgress(liveElapsed, record.targetSeconds);

  return {
    commitment: habit,
    trackingType,
    record,
    status: computeDisplayStatus(record, timer, dailyResetHour),
    liveElapsed,
    remaining: remainingSeconds,
    percent,
    isTimedHere,
  };
}

// Daily completion for COMPLETION-type habits: marking a scheduled day done
// or not-done. No timer is ever involved for these habits — this is the
// entire tracking mechanism for them. Pure functions; the caller
// (AppContext) is responsible for persisting the returned record.

import type { HabitDayRecord } from './model';

/** Marks a day record DONE, stamping `completedAt` with `now` (defaults to
 *  the current time; injectable for deterministic tests). Idempotent: if
 *  the record is already DONE, its original completedAt is preserved. */
export function completeHabitDay(record: HabitDayRecord, now: () => number = () => Date.now()): HabitDayRecord {
  if (record.status === 'DONE') return record;
  return { ...record, status: 'DONE', completedAt: now() };
}

/** Reopens a DONE day record back to NOT_STARTED, clearing `completedAt`.
 *  Idempotent: reopening an already-not-done record is a no-op. */
export function reopenHabitDay(record: HabitDayRecord): HabitDayRecord {
  if (record.status !== 'DONE') return record;
  return { ...record, status: 'NOT_STARTED', completedAt: undefined };
}

/** Flips a day record between DONE and NOT_STARTED. Extracted verbatim
 *  from AppContext's toggleTodayCompletion — same DONE/undo semantics. */
export function toggleHabitDayCompletion(
  record: HabitDayRecord,
  now: () => number = () => Date.now(),
): HabitDayRecord {
  return record.status === 'DONE' ? reopenHabitDay(record) : completeHabitDay(record, now);
}

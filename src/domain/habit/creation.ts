// Habit creation and editing: form validation plus the pure construction
// logic for turning validated input into a new Habit (Commitment) and its
// scheduled HabitDayRecords (DayRecords). No I/O here — the repository
// layer (db/commitments.repo.ts) is the only place that persists what this
// module builds.

import type { TrackingType } from '../../types';
import type { Habit, HabitDayRecord } from './model';
import { computeEndDate, enumerateDates } from '../../utils/date';

// ---------- Form validation ----------
// Moved verbatim from domain/commitmentForm.ts (same rules, same messages).

export interface CommitmentFormValues {
  name: string;
  trackingType: TrackingType;
  hours: string;
  minutes: string;
  duration: string;
  startDate: string;
}

export interface CommitmentFormErrors {
  name?: string;
  hours?: string;
  minutes?: string;
  duration?: string;
  startDate?: string;
}

export function validateCommitmentForm(values: CommitmentFormValues): CommitmentFormErrors {
  const { name, trackingType, hours, minutes, duration, startDate } = values;
  const isCompletion = trackingType === 'COMPLETION';
  const hoursNum = Number(hours);
  const minutesNum = Number(minutes);
  const durationNum = Number(duration);
  const dailyTargetSeconds = isCompletion ? 0 : (hoursNum || 0) * 3600 + (minutesNum || 0) * 60;

  const next: CommitmentFormErrors = {};
  if (!name.trim()) next.name = 'Commitment name is required.';
  if (!isCompletion) {
    if (!hours && !minutes) next.hours = 'Daily target is required.';
    if (hoursNum < 0 || minutesNum < 0 || minutesNum > 59) next.minutes = 'Enter a valid duration.';
    if (dailyTargetSeconds <= 0) next.hours = 'Daily target must be greater than zero.';
  }
  if (!duration || durationNum < 1 || !Number.isInteger(durationNum)) {
    next.duration = 'Duration must be a whole number of at least 1 day.';
  }
  if (!startDate) next.startDate = 'Start date is required.';
  return next;
}

// ---------- Construction ----------
// The pure "shape a new habit" logic that used to live inline inside
// db/commitments.repo.ts's createCommitment(). Kept separate from
// persistence: this module decides WHAT a new habit and its scheduled days
// look like; the repository decides how to save them.

export interface NewHabitInput {
  name: string;
  dailyTargetSeconds: number;
  durationDays: number;
  startDate: string;
  /** Defaults to 'DURATION' when omitted, to keep existing callers/tests working. */
  trackingType?: TrackingType;
}

export interface BuiltHabit {
  habit: Habit;
  dayRecords: HabitDayRecord[];
}

/** `${habitId}_${date}` — the deterministic id for a habit-day pair. */
export function habitDayRecordId(habitId: string, date: string): string {
  return `${habitId}_${date}`;
}

/**
 * Builds a new Habit plus one HabitDayRecord for every day it's scheduled,
 * from validated input. Pure — assigns an id and createdAt timestamp but
 * performs no I/O. `newId`/`now` are injectable for deterministic tests;
 * callers in production code can omit them.
 */
export function buildHabit(
  input: NewHabitInput,
  newId: () => string = () => crypto.randomUUID(),
  now: () => number = () => Date.now(),
): BuiltHabit {
  const endDate = computeEndDate(input.startDate, input.durationDays);
  const trackingType = input.trackingType ?? 'DURATION';
  // Completion habits have no timer target — force this to 0 regardless of
  // what was passed in, so history/progress math never sees stray seconds.
  const dailyTargetSeconds = trackingType === 'COMPLETION' ? 0 : input.dailyTargetSeconds;

  const habit: Habit = {
    id: newId(),
    name: input.name.trim(),
    dailyTargetSeconds,
    durationDays: input.durationDays,
    trackingType,
    startDate: input.startDate,
    endDate,
    createdAt: now(),
  };

  const dayRecords: HabitDayRecord[] = enumerateDates(input.startDate, endDate).map((date) => ({
    id: habitDayRecordId(habit.id, date),
    commitmentId: habit.id,
    date,
    targetSeconds: dailyTargetSeconds,
    elapsedSeconds: 0,
    status: 'NOT_STARTED',
  }));

  return { habit, dayRecords };
}

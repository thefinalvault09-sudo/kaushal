// The habit domain model. This module defines the vocabulary the rest of
// the habit system (creation, daily completion, duration tracking, timer
// logic, daily progress, history) is built on, plus the small set of type
// predicates used to branch between the two supported habit types:
//
//   - DURATION:   a timer-based habit with an hours/minutes daily target.
//   - COMPLETION: a simple Done/Not-Done habit with no timer at all.
//
// `Habit` and `HabitDayRecord` are aliases for the existing persisted
// `Commitment`/`DayRecord` types (see ../../types.ts) rather than new
// shapes — the storage schema is unchanged, this module just gives the
// business-logic layer names that describe what these things ARE (a habit,
// a day of that habit) instead of the persistence-oriented names the
// storage layer uses.

import type { Commitment, DayRecord, TrackingType } from '../../types';

/** A habit the user is tracking. Alias for the persisted `Commitment`. */
export type Habit = Commitment;

/** One scheduled day of a habit. Alias for the persisted `DayRecord`. */
export type HabitDayRecord = DayRecord;

/** Which of the two supported tracking types govern a habit. */
export type HabitType = TrackingType;

export const HABIT_TYPES = {
  DURATION: 'DURATION',
  COMPLETION: 'COMPLETION',
} as const satisfies Record<HabitType, HabitType>;

/** True for a timer-based habit with an hours/minutes daily target. */
export function isDurationHabit(habit: Habit): boolean {
  return habitType(habit) === HABIT_TYPES.DURATION;
}

/** True for a simple Done/Not-Done habit with no timer. */
export function isCompletionHabit(habit: Habit): boolean {
  return habitType(habit) === HABIT_TYPES.COMPLETION;
}

/** Resolves a habit's type, defaulting to DURATION for habits created
 *  before `trackingType` existed (see Habit.trackingType's own doc comment
 *  in types.ts for why that default is load-bearing for old data). */
function habitType(habit: Habit): HabitType {
  return habit.trackingType ?? HABIT_TYPES.DURATION;
}

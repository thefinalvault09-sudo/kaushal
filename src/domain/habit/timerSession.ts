// Timer-session logic for DURATION habits: starting, pausing, resuming, and
// stopping a session, plus the auto-complete check the ticking clock uses
// while a session is running. Built on top of timer/engine.ts's pure
// elapsed-time math. Every function here is pure — it returns the next
// TimerState/HabitDayRecord it computed; the caller (AppContext) is
// responsible for persisting the result and updating React state.
//
// Extracted from context/AppContext.tsx's startTimer/pauseTimer/
// resumeTimer/stopTimer/completeFromTimer, formula-for-formula.

import type { HabitDayRecord } from './model';
import type { TimerState } from '../../types';
import { cappedElapsedSeconds, totalElapsedSeconds } from '../../timer/engine';

/**
 * Validates that a new session is allowed to start against `record`, given
 * whatever timer (if any) is currently active elsewhere in the app. Throws
 * with the same messages AppContext.startTimer always has, rather than
 * returning a result type, so call sites don't need to change their
 * try/catch shape.
 */
export function assertCanStartSession(existingTimer: TimerState | null, record: HabitDayRecord | undefined): void {
  if (existingTimer) {
    throw new Error('Another timer is already running. Stop it before starting a new one.');
  }
  if (!record) {
    throw new Error('This commitment has no scheduled target for today.');
  }
  if (record.status === 'DONE') {
    throw new Error('Today\u2019s target is already complete.');
  }
}

/** Builds a fresh running TimerState for `commitmentId`/`date`, carrying
 *  forward whatever the record already had recorded as its baseline. */
export function startSession(commitmentId: string, date: string, baselineSeconds: number, nowMs: number): TimerState {
  return {
    id: 'current',
    commitmentId,
    dayDate: date,
    status: 'running',
    baselineSeconds,
    accumulatedSeconds: 0,
    runStartedAt: nowMs,
  };
}

/** Transitions a running timer to paused, folding the just-finished running
 *  segment into `accumulatedSeconds`. A no-op (returns the input unchanged)
 *  if the timer isn't actually running. */
export function pauseSession(timer: TimerState, nowMs: number): TimerState {
  if (timer.status !== 'running' || timer.runStartedAt == null) return timer;
  const ranSeconds = Math.max(0, (nowMs - timer.runStartedAt) / 1000);
  return {
    ...timer,
    status: 'paused',
    accumulatedSeconds: timer.accumulatedSeconds + ranSeconds,
    runStartedAt: null,
  };
}

/** Transitions a paused timer back to running. A no-op if it isn't paused. */
export function resumeSession(timer: TimerState, nowMs: number): TimerState {
  if (timer.status !== 'paused') return timer;
  return { ...timer, status: 'running', runStartedAt: nowMs };
}

/**
 * Applies a pause to the day record being timed: caps elapsed seconds at
 * the target and, if any time was recorded, marks the record PARTIAL
 * (never downgrades an already-DONE/whatever status if capped is 0).
 */
export function applyPauseToRecord(pausedTimer: TimerState, record: HabitDayRecord, nowMs: number): HabitDayRecord {
  const capped = cappedElapsedSeconds(pausedTimer, record.targetSeconds, nowMs);
  return { ...record, elapsedSeconds: capped, status: capped > 0 ? 'PARTIAL' : record.status };
}

/**
 * Applies a stop to the day record being timed: caps elapsed seconds at the
 * target, and marks the record DONE (stamping completedAt) if the target
 * was reached, otherwise PARTIAL if any time was recorded.
 */
export function applyStopToRecord(timer: TimerState, record: HabitDayRecord, nowMs: number): HabitDayRecord {
  const capped = cappedElapsedSeconds(timer, record.targetSeconds, nowMs);
  const reachedTarget = capped >= record.targetSeconds;
  return {
    ...record,
    elapsedSeconds: capped,
    status: reachedTarget ? 'DONE' : capped > 0 ? 'PARTIAL' : record.status,
    completedAt: reachedTarget ? record.completedAt ?? nowMs : record.completedAt,
  };
}

/** True once a running session's total elapsed time has reached the day's
 *  target — the ticking clock in AppContext polls this to auto-complete. */
export function hasReachedTarget(timer: TimerState, record: HabitDayRecord, nowMs: number): boolean {
  return totalElapsedSeconds(timer, nowMs) >= record.targetSeconds;
}

/** Applies an auto-complete (target reached while running, unattended) to
 *  the day record: caps elapsed seconds and marks it DONE. */
export function applyAutoCompleteToRecord(timer: TimerState, record: HabitDayRecord, nowMs: number): HabitDayRecord {
  const capped = cappedElapsedSeconds(timer, record.targetSeconds, nowMs);
  return { ...record, elapsedSeconds: capped, status: 'DONE', completedAt: record.completedAt ?? nowMs };
}

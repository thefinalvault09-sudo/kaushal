// Pure timer math. Kept separate from the React context so it can be unit
// tested without touching IndexedDB or React at all.

import type { TimerState } from '../types';

/** Seconds accrued within the CURRENT session (baseline excluded). */
export function sessionElapsedSeconds(timer: TimerState, nowMs: number): number {
  const isRunning = timer.status === 'running' && timer.runStartedAt != null;
  const runningSeconds = isRunning ? Math.max(0, (nowMs - timer.runStartedAt!) / 1000) : 0;
  return timer.accumulatedSeconds + runningSeconds;
}

/** Total elapsed seconds for the day (baseline + this session), uncapped. */
export function totalElapsedSeconds(timer: TimerState, nowMs: number): number {
  return timer.baselineSeconds + sessionElapsedSeconds(timer, nowMs);
}

/** Total elapsed seconds capped at the day's target — never exceeds 100%. */
export function cappedElapsedSeconds(timer: TimerState, targetSeconds: number, nowMs: number): number {
  return Math.min(targetSeconds, totalElapsedSeconds(timer, nowMs));
}

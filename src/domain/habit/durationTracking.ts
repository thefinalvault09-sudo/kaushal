// Duration-based progress math for a single scheduled day: how much of the
// daily target has been reached, how much remains, and the resulting fill
// percentage. Pure — takes plain numbers, no Habit/DayRecord/TimerState
// coupling, so it's usable from both the today-item derivation and (if
// ever needed) anywhere else that has an elapsed/target pair.

export interface DurationProgress {
  /** 0-100, capped — never exceeds 100% of the target. */
  percent: number;
  /** targetSeconds - elapsedSeconds, floored at 0. */
  remainingSeconds: number;
}

/**
 * Computes fill percent + remaining seconds for a DURATION habit's day.
 * A `targetSeconds` of 0 (which should never happen for a real DURATION
 * habit, but can appear on legacy/edge-case data) resolves to 0% rather
 * than dividing by zero — same guard the original inline formula had.
 */
export function computeDurationProgress(elapsedSeconds: number, targetSeconds: number): DurationProgress {
  const remainingSeconds = Math.max(0, targetSeconds - elapsedSeconds);
  const percent = targetSeconds > 0 ? Math.min(100, (elapsedSeconds / targetSeconds) * 100) : 0;
  return { percent, remainingSeconds };
}

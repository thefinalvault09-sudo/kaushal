import { describe, expect, it } from 'vitest';
import { computeDurationProgress } from './durationTracking';

describe('computeDurationProgress', () => {
  it('computes partial percent and remaining seconds', () => {
    const result = computeDurationProgress(900, 3600);
    expect(result.percent).toBe(25);
    expect(result.remainingSeconds).toBe(2700);
  });

  it('caps percent at 100 and remaining at 0 when elapsed exceeds target', () => {
    const result = computeDurationProgress(4000, 3600);
    expect(result.percent).toBe(100);
    expect(result.remainingSeconds).toBe(0);
  });

  it('returns exactly 100% at the target boundary', () => {
    const result = computeDurationProgress(3600, 3600);
    expect(result.percent).toBe(100);
    expect(result.remainingSeconds).toBe(0);
  });

  it('returns 0% for a zero target instead of dividing by zero', () => {
    const result = computeDurationProgress(0, 0);
    expect(result.percent).toBe(0);
    expect(result.remainingSeconds).toBe(0);
  });

  it('returns 0% at zero elapsed seconds', () => {
    const result = computeDurationProgress(0, 3600);
    expect(result.percent).toBe(0);
    expect(result.remainingSeconds).toBe(3600);
  });
});

import { describe, expect, it } from 'vitest';
import { isCompletionHabit, isDurationHabit } from './model';
import type { Habit } from './model';

function habit(overrides: Partial<Habit>): Habit {
  return {
    id: 'c1',
    name: 'Test',
    dailyTargetSeconds: 3600,
    durationDays: 30,
    startDate: '2026-01-01',
    endDate: '2026-01-30',
    createdAt: 0,
    ...overrides,
  };
}

describe('isDurationHabit / isCompletionHabit', () => {
  it('identifies an explicit DURATION habit', () => {
    const h = habit({ trackingType: 'DURATION' });
    expect(isDurationHabit(h)).toBe(true);
    expect(isCompletionHabit(h)).toBe(false);
  });

  it('identifies an explicit COMPLETION habit', () => {
    const h = habit({ trackingType: 'COMPLETION' });
    expect(isDurationHabit(h)).toBe(false);
    expect(isCompletionHabit(h)).toBe(true);
  });

  it('defaults a legacy habit with no trackingType to DURATION', () => {
    const legacy = habit({});
    delete legacy.trackingType;
    expect(isDurationHabit(legacy)).toBe(true);
    expect(isCompletionHabit(legacy)).toBe(false);
  });
});

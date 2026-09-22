import { describe, expect, it } from 'vitest';
import { completeHabitDay, reopenHabitDay, toggleHabitDayCompletion } from './dailyCompletion';
import type { HabitDayRecord } from './model';

function record(overrides: Partial<HabitDayRecord>): HabitDayRecord {
  return {
    id: 'c1_2026-01-01',
    commitmentId: 'c1',
    date: '2026-01-01',
    targetSeconds: 0,
    elapsedSeconds: 0,
    status: 'NOT_STARTED',
    ...overrides,
  };
}

describe('completeHabitDay', () => {
  it('marks a NOT_STARTED record DONE and stamps completedAt', () => {
    const updated = completeHabitDay(record({}), () => 12345);
    expect(updated.status).toBe('DONE');
    expect(updated.completedAt).toBe(12345);
  });

  it('is idempotent: an already-DONE record keeps its original completedAt', () => {
    const done = record({ status: 'DONE', completedAt: 111 });
    const updated = completeHabitDay(done, () => 999);
    expect(updated).toBe(done);
    expect(updated.completedAt).toBe(111);
  });
});

describe('reopenHabitDay', () => {
  it('resets a DONE record to NOT_STARTED and clears completedAt', () => {
    const done = record({ status: 'DONE', completedAt: 111 });
    const updated = reopenHabitDay(done);
    expect(updated.status).toBe('NOT_STARTED');
    expect(updated.completedAt).toBeUndefined();
  });

  it('is a no-op for a record that is not DONE', () => {
    const notDone = record({ status: 'NOT_STARTED' });
    expect(reopenHabitDay(notDone)).toBe(notDone);
  });
});

describe('toggleHabitDayCompletion', () => {
  it('completes an incomplete day', () => {
    const updated = toggleHabitDayCompletion(record({ status: 'NOT_STARTED' }), () => 500);
    expect(updated.status).toBe('DONE');
    expect(updated.completedAt).toBe(500);
  });

  it('un-completes a completed day', () => {
    const updated = toggleHabitDayCompletion(record({ status: 'DONE', completedAt: 500 }));
    expect(updated.status).toBe('NOT_STARTED');
    expect(updated.completedAt).toBeUndefined();
  });

  it('round-trips: complete then toggle again returns to not-started', () => {
    const start = record({ status: 'NOT_STARTED' });
    const completed = toggleHabitDayCompletion(start, () => 1);
    const reopened = toggleHabitDayCompletion(completed);
    expect(reopened.status).toBe('NOT_STARTED');
    expect(reopened.completedAt).toBeUndefined();
  });
});

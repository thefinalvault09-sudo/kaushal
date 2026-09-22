import { describe, expect, it } from 'vitest';
import { summarizeProgress } from './dailyProgress';
import type { DayRecord } from '../../types';
import { addDays, todayISO } from '../../utils/date';

function record(overrides: Partial<DayRecord>): DayRecord {
  return {
    id: 'r',
    commitmentId: 'c1',
    date: todayISO(),
    targetSeconds: 3600,
    elapsedSeconds: 0,
    status: 'NOT_STARTED',
    ...overrides,
  };
}

describe('summarizeProgress', () => {
  it('counts completed, partial, and missed days factually', () => {
    const yesterday = addDays(todayISO(), -1);
    const twoDaysAgo = addDays(todayISO(), -2);
    const tomorrow = addDays(todayISO(), 1);

    const records: DayRecord[] = [
      record({ id: '1', date: twoDaysAgo, status: 'DONE', elapsedSeconds: 3600, completedAt: Date.now() }),
      record({ id: '2', date: yesterday, status: 'PARTIAL', elapsedSeconds: 1200 }),
      record({ id: '3', date: yesterday, status: 'NOT_STARTED', elapsedSeconds: 0 }),
      record({ id: '4', date: tomorrow, status: 'NOT_STARTED', elapsedSeconds: 0 }),
    ];

    const summary = summarizeProgress(records);
    expect(summary.totalPlanned).toBe(4);
    expect(summary.completedDays).toBe(1);
    expect(summary.partialDays).toBe(1);
    expect(summary.missedDays).toBe(1); // yesterday, untouched -> missed
    expect(summary.notStartedFuture).toBe(1); // tomorrow
  });

  it('never exceeds 100% completion regardless of input', () => {
    const records: DayRecord[] = [record({ status: 'DONE', elapsedSeconds: 3600 })];
    const summary = summarizeProgress(records);
    expect(summary.completionPercent).toBeLessThanOrEqual(100);
    expect(summary.completionPercent).toBe(100);
  });

  it('computes consistency only from days whose window has passed', () => {
    const yesterday = addDays(todayISO(), -1);
    const records: DayRecord[] = [
      record({ id: '1', date: yesterday, status: 'DONE', elapsedSeconds: 3600, completedAt: Date.now() }),
      record({ id: '2', date: addDays(todayISO(), 5), status: 'NOT_STARTED' }), // future, excluded
    ];
    const summary = summarizeProgress(records);
    expect(summary.consistencyPercent).toBe(100);
  });

  it('returns zero percentages for an empty record set without dividing by zero', () => {
    const summary = summarizeProgress([]);
    expect(summary.completionPercent).toBe(0);
    expect(summary.consistencyPercent).toBe(0);
  });
});

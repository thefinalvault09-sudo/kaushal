import { describe, expect, it } from 'vitest';
import { deriveTodayItem } from './todayItem';
import type { Commitment, DayRecord, TimerState } from '../../types';

function commitment(overrides: Partial<Commitment>): Commitment {
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

function record(overrides: Partial<DayRecord>): DayRecord {
  return {
    id: 'c1_2026-01-01',
    commitmentId: 'c1',
    date: '2026-01-01',
    targetSeconds: 3600,
    elapsedSeconds: 0,
    status: 'NOT_STARTED',
    ...overrides,
  };
}

describe('deriveTodayItem', () => {
  it('uses the persisted elapsedSeconds when no timer is running for this commitment/day', () => {
    const item = deriveTodayItem(commitment({}), record({ elapsedSeconds: 900 }), '2026-01-01', null, Date.now());
    expect(item.liveElapsed).toBe(900);
    expect(item.isTimedHere).toBe(false);
    expect(item.remaining).toBe(2700);
  });

  it('computes live elapsed time from the timer when it is running against this exact commitment/day', () => {
    const timer: TimerState = {
      id: 'current',
      commitmentId: 'c1',
      dayDate: '2026-01-01',
      status: 'running',
      baselineSeconds: 0,
      accumulatedSeconds: 0,
      runStartedAt: 0,
    };
    const item = deriveTodayItem(commitment({}), record({}), '2026-01-01', timer, 30_000);
    expect(item.isTimedHere).toBe(true);
    expect(item.liveElapsed).toBeCloseTo(30, 5);
  });

  it('ignores a timer running against a different commitment', () => {
    const timer: TimerState = {
      id: 'current',
      commitmentId: 'other',
      dayDate: '2026-01-01',
      status: 'running',
      baselineSeconds: 0,
      accumulatedSeconds: 0,
      runStartedAt: 0,
    };
    const item = deriveTodayItem(commitment({}), record({ elapsedSeconds: 500 }), '2026-01-01', timer, 30_000);
    expect(item.isTimedHere).toBe(false);
    expect(item.liveElapsed).toBe(500);
  });

  it('reports 100% for a DONE COMPLETION commitment and 0% otherwise, ignoring targetSeconds', () => {
    const c = commitment({ trackingType: 'COMPLETION', dailyTargetSeconds: 0 });
    const done = deriveTodayItem(c, record({ targetSeconds: 0, status: 'DONE' }), '2026-01-01', null, Date.now());
    const notDone = deriveTodayItem(c, record({ targetSeconds: 0, status: 'NOT_STARTED' }), '2026-01-01', null, Date.now());
    expect(done.percent).toBe(100);
    expect(notDone.percent).toBe(0);
  });

  it('caps percent at 100 for a DURATION commitment even if elapsed exceeds target', () => {
    const item = deriveTodayItem(
      commitment({ dailyTargetSeconds: 60 }),
      record({ targetSeconds: 60, elapsedSeconds: 60 }),
      '2026-01-01',
      null,
      Date.now(),
    );
    expect(item.percent).toBe(100);
    expect(item.remaining).toBe(0);
  });
});

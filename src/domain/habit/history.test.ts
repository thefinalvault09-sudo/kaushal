import { describe, expect, it } from 'vitest';
import { computeDisplayStatus, groupByWeek } from './history';
import type { DayRecord, TimerState } from '../../types';
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

describe('computeDisplayStatus', () => {
  it('marks a past, untouched day as MISSED', () => {
    const r = record({ date: addDays(todayISO(), -1), status: 'NOT_STARTED', elapsedSeconds: 0 });
    expect(computeDisplayStatus(r)).toBe('MISSED');
  });

  it('marks a past day with partial time but not DONE as MISSED (day is over)', () => {
    const r = record({ date: addDays(todayISO(), -1), status: 'PARTIAL', elapsedSeconds: 600 });
    expect(computeDisplayStatus(r)).toBe('MISSED');
  });

  it('marks a future day as NOT_STARTED', () => {
    const r = record({ date: addDays(todayISO(), 2), status: 'NOT_STARTED', elapsedSeconds: 0 });
    expect(computeDisplayStatus(r)).toBe('NOT_STARTED');
  });

  it("marks today's untouched day as NOT_STARTED", () => {
    const r = record({ date: todayISO(), status: 'NOT_STARTED', elapsedSeconds: 0 });
    expect(computeDisplayStatus(r)).toBe('NOT_STARTED');
  });

  it("marks today's day with partial progress as PARTIAL when no timer is active", () => {
    const r = record({ date: todayISO(), status: 'NOT_STARTED', elapsedSeconds: 300 });
    expect(computeDisplayStatus(r)).toBe('PARTIAL');
  });

  it('marks the record as IN_PROGRESS while its timer is actively running', () => {
    const r = record({ date: todayISO() });
    const timer: TimerState = {
      id: 'current',
      commitmentId: 'c1',
      dayDate: todayISO(),
      status: 'running',
      baselineSeconds: 0,
      accumulatedSeconds: 0,
      runStartedAt: Date.now(),
    };
    expect(computeDisplayStatus(r, timer)).toBe('IN_PROGRESS');
  });

  it('marks a DONE record completed on its scheduled date as DONE', () => {
    const today = todayISO();
    const now = Date.now();
    const r = record({ date: today, status: 'DONE', elapsedSeconds: 3600, completedAt: now });
    expect(computeDisplayStatus(r)).toBe('DONE');
  });

  it('marks a DONE record completed after its scheduled date as COMPLETED_LATE, preserving the original date', () => {
    const scheduledDate = addDays(todayISO(), -3);
    const r = record({ date: scheduledDate, status: 'DONE', elapsedSeconds: 3600, completedAt: Date.now() });
    expect(computeDisplayStatus(r)).toBe('COMPLETED_LATE');
    // The scheduled date itself must never move.
    expect(r.date).toBe(scheduledDate);
  });

  // Completion-only habits (targetSeconds always 0, elapsedSeconds always 0,
  // never attached to a timer) must resolve the same way as any other
  // record: NOT_STARTED/MISSED before completion, DONE/COMPLETED_LATE after.
  it("marks an untouched completion habit's today record as NOT_STARTED", () => {
    const r = record({ date: todayISO(), status: 'NOT_STARTED', elapsedSeconds: 0, targetSeconds: 0 });
    expect(computeDisplayStatus(r)).toBe('NOT_STARTED');
  });

  it('marks a completion habit completed today as DONE', () => {
    const r = record({ date: todayISO(), status: 'DONE', elapsedSeconds: 0, targetSeconds: 0, completedAt: Date.now() });
    expect(computeDisplayStatus(r)).toBe('DONE');
  });

  it('marks a past, uncompleted completion habit day as MISSED', () => {
    const r = record({ date: addDays(todayISO(), -1), status: 'NOT_STARTED', elapsedSeconds: 0, targetSeconds: 0 });
    expect(computeDisplayStatus(r)).toBe('MISSED');
  });
});

describe('groupByWeek', () => {
  it('returns an empty array for no records', () => {
    expect(groupByWeek([])).toEqual([]);
  });

  it('pads the first week with leading nulls up to the first record\'s weekday', () => {
    // 2026-01-01 is a Thursday (day index 4).
    const records: DayRecord[] = [record({ id: '1', date: '2026-01-01' })];
    const weeks = groupByWeek(records);
    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toHaveLength(7);
    expect(weeks[0].slice(0, 4)).toEqual([null, null, null, null]);
    expect(weeks[0][4]?.date).toBe('2026-01-01');
  });

  it('pads the trailing week with nulls up to 7 columns', () => {
    const records: DayRecord[] = [
      record({ id: '1', date: '2026-01-01' }),
      record({ id: '2', date: '2026-01-02' }),
    ];
    const weeks = groupByWeek(records);
    expect(weeks[weeks.length - 1]).toHaveLength(7);
  });

  it('splits a full week correctly with no padding needed mid-sequence', () => {
    // 2026-01-04 is a Sunday, so a 7-day run from there fills one week exactly.
    const dates = ['2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10'];
    const records: DayRecord[] = dates.map((date, i) => record({ id: String(i), date }));
    const weeks = groupByWeek(records);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].map((r) => r?.date)).toEqual(dates);
  });
});

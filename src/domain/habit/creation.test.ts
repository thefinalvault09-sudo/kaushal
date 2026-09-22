import { describe, expect, it } from 'vitest';
import { buildHabit, habitDayRecordId, validateCommitmentForm, type CommitmentFormValues } from './creation';
import { computeEndDate } from '../../utils/date';

function values(overrides: Partial<CommitmentFormValues>): CommitmentFormValues {
  return {
    name: 'Study',
    trackingType: 'DURATION',
    hours: '1',
    minutes: '0',
    duration: '30',
    startDate: '2026-01-01',
    ...overrides,
  };
}

describe('validateCommitmentForm', () => {
  it('passes for a valid DURATION form', () => {
    expect(validateCommitmentForm(values({}))).toEqual({});
  });

  it('requires a name', () => {
    expect(validateCommitmentForm(values({ name: '  ' })).name).toBeDefined();
  });

  it('requires a nonzero daily target for DURATION commitments', () => {
    const errors = validateCommitmentForm(values({ hours: '0', minutes: '0' }));
    expect(errors.hours).toBeDefined();
  });

  it('skips the daily-target requirement entirely for COMPLETION commitments', () => {
    const errors = validateCommitmentForm(values({ trackingType: 'COMPLETION', hours: '0', minutes: '0' }));
    expect(errors.hours).toBeUndefined();
    expect(errors.minutes).toBeUndefined();
  });

  it('rejects an out-of-range minutes value', () => {
    expect(validateCommitmentForm(values({ minutes: '60' })).minutes).toBeDefined();
  });

  it('requires a whole-number duration of at least 1 day', () => {
    expect(validateCommitmentForm(values({ duration: '0' })).duration).toBeDefined();
    expect(validateCommitmentForm(values({ duration: '2.5' })).duration).toBeDefined();
  });

  it('requires a start date', () => {
    expect(validateCommitmentForm(values({ startDate: '' })).startDate).toBeDefined();
  });
});

describe('buildHabit', () => {
  it('creates one day record for every scheduled day, inclusive of start and end', () => {
    const { habit, dayRecords } = buildHabit(
      { name: 'Study Electronics', dailyTargetSeconds: 7200, durationDays: 7, startDate: '2026-01-01' },
      () => 'fixed-id',
      () => 12345,
    );

    expect(habit.id).toBe('fixed-id');
    expect(habit.createdAt).toBe(12345);
    expect(habit.endDate).toBe(computeEndDate('2026-01-01', 7));
    expect(habit.endDate).toBe('2026-01-07');
    expect(habit.trackingType).toBe('DURATION');

    expect(dayRecords).toHaveLength(7);
    expect(dayRecords[0].date).toBe('2026-01-01');
    expect(dayRecords[6].date).toBe('2026-01-07');
    expect(dayRecords.every((r) => r.status === 'NOT_STARTED')).toBe(true);
    expect(dayRecords.every((r) => r.targetSeconds === 7200)).toBe(true);
    expect(dayRecords.every((r) => r.commitmentId === 'fixed-id')).toBe(true);
  });

  it('defaults trackingType to DURATION when omitted', () => {
    const { habit } = buildHabit({ name: 'Legacy', dailyTargetSeconds: 1800, durationDays: 2, startDate: '2026-06-01' });
    expect(habit.trackingType).toBe('DURATION');
  });

  it('forces dailyTargetSeconds to 0 for a COMPLETION habit, even if a nonzero value is passed', () => {
    const { habit, dayRecords } = buildHabit({
      name: 'Drink 3L Water',
      dailyTargetSeconds: 9999,
      durationDays: 4,
      startDate: '2026-06-10',
      trackingType: 'COMPLETION',
    });

    expect(habit.trackingType).toBe('COMPLETION');
    expect(habit.dailyTargetSeconds).toBe(0);
    expect(dayRecords).toHaveLength(4);
    expect(dayRecords.every((r) => r.targetSeconds === 0)).toBe(true);
  });

  it('builds deterministic day-record ids as `${habitId}_${date}`', () => {
    expect(habitDayRecordId('c1', '2026-01-01')).toBe('c1_2026-01-01');
  });
});

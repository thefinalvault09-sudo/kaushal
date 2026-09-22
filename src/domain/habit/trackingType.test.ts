import { describe, expect, it } from 'vitest';
import { formatTrackingLabel, resolveTrackingType } from './trackingType';
import type { Commitment } from '../../types';

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

describe('resolveTrackingType', () => {
  it('returns the explicit trackingType when set', () => {
    expect(resolveTrackingType(commitment({ trackingType: 'COMPLETION' }))).toBe('COMPLETION');
    expect(resolveTrackingType(commitment({ trackingType: 'DURATION' }))).toBe('DURATION');
  });

  it('defaults to DURATION when trackingType is absent (legacy data)', () => {
    const legacy = commitment({});
    delete legacy.trackingType;
    expect(resolveTrackingType(legacy)).toBe('DURATION');
  });
});

describe('formatTrackingLabel', () => {
  it('formats a DURATION commitment as "Xh Ym / day"', () => {
    expect(formatTrackingLabel(commitment({ trackingType: 'DURATION', dailyTargetSeconds: 5400 }))).toBe(
      '1h 30m / day',
    );
  });

  it('formats a COMPLETION commitment as "Completion" regardless of dailyTargetSeconds', () => {
    expect(formatTrackingLabel(commitment({ trackingType: 'COMPLETION', dailyTargetSeconds: 0 }))).toBe(
      'Completion',
    );
  });
});

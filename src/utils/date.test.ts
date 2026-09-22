import { describe, expect, it } from 'vitest';
import { addDays, computeEndDate, enumerateDates, toISODate, parseISODate } from './date';

describe('date utils', () => {
  it('formats a Date as local YYYY-MM-DD', () => {
    const d = new Date(2026, 0, 5); // Jan 5, 2026 local
    expect(toISODate(d)).toBe('2026-01-05');
  });

  it('parses an ISO date back to the same local date', () => {
    const d = parseISODate('2026-01-05');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(5);
  });

  it('adds days correctly across month boundaries', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02');
  });

  it('adds negative days correctly', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('computes an inclusive end date: start + duration - 1', () => {
    // Spec example: Start Jan 1, duration 7 days -> Jan 1 to Jan 7.
    expect(computeEndDate('2026-01-01', 7)).toBe('2026-01-07');
  });

  it('enumerates every scheduled date inclusive of start and end', () => {
    const dates = enumerateDates('2026-01-01', '2026-01-07');
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe('2026-01-01');
    expect(dates[6]).toBe('2026-01-07');
  });

  it('handles a single-day duration', () => {
    expect(computeEndDate('2026-06-15', 1)).toBe('2026-06-15');
    expect(enumerateDates('2026-06-15', computeEndDate('2026-06-15', 1))).toEqual(['2026-06-15']);
  });
});

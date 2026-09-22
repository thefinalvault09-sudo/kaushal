import { describe, expect, it } from 'vitest';
import { cappedElapsedSeconds, sessionElapsedSeconds, totalElapsedSeconds } from './engine';
import type { TimerState } from '../types';

const baseTimer: TimerState = {
  id: 'current',
  commitmentId: 'c1',
  dayDate: '2026-09-16',
  status: 'running',
  baselineSeconds: 0,
  accumulatedSeconds: 0,
  runStartedAt: 1000,
};

describe('timer engine', () => {
  it('computes session elapsed time from a running segment', () => {
    const now = 1000 + 30_000; // 30s later
    expect(sessionElapsedSeconds(baseTimer, now)).toBeCloseTo(30, 5);
  });

  it('adds accumulated time from prior segments while running', () => {
    const timer: TimerState = { ...baseTimer, accumulatedSeconds: 45, runStartedAt: 1000 };
    const now = 1000 + 10_000;
    expect(sessionElapsedSeconds(timer, now)).toBeCloseTo(55, 5);
  });

  it('returns only accumulated time while paused (no running segment)', () => {
    const timer: TimerState = { ...baseTimer, status: 'paused', accumulatedSeconds: 45, runStartedAt: null };
    expect(sessionElapsedSeconds(timer, Date.now())).toBe(45);
  });

  it('includes baseline seconds already recorded on the day before this session', () => {
    const timer: TimerState = { ...baseTimer, baselineSeconds: 120, accumulatedSeconds: 0, runStartedAt: 1000 };
    const now = 1000 + 10_000;
    expect(totalElapsedSeconds(timer, now)).toBeCloseTo(130, 5);
  });

  it('never reports capped elapsed time above the target (100% cap)', () => {
    const timer: TimerState = { ...baseTimer, baselineSeconds: 0, accumulatedSeconds: 0, runStartedAt: 0 };
    const targetSeconds = 60;
    const now = 120_000; // way more than target
    expect(cappedElapsedSeconds(timer, targetSeconds, now)).toBe(60);
  });

  it('caps exactly at the target boundary, not before', () => {
    const timer: TimerState = { ...baseTimer, baselineSeconds: 0, accumulatedSeconds: 0, runStartedAt: 0 };
    const targetSeconds = 60;
    expect(cappedElapsedSeconds(timer, targetSeconds, 59_000)).toBeCloseTo(59, 5);
    expect(cappedElapsedSeconds(timer, targetSeconds, 60_000)).toBe(60);
  });
});

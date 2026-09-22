import { describe, expect, it } from 'vitest';
import {
  applyAutoCompleteToRecord,
  applyPauseToRecord,
  applyStopToRecord,
  assertCanStartSession,
  hasReachedTarget,
  pauseSession,
  resumeSession,
  startSession,
} from './timerSession';
import type { HabitDayRecord } from './model';
import type { TimerState } from '../../types';

function record(overrides: Partial<HabitDayRecord>): HabitDayRecord {
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

function timer(overrides: Partial<TimerState>): TimerState {
  return {
    id: 'current',
    commitmentId: 'c1',
    dayDate: '2026-01-01',
    status: 'running',
    baselineSeconds: 0,
    accumulatedSeconds: 0,
    runStartedAt: 0,
    ...overrides,
  };
}

describe('assertCanStartSession', () => {
  it('throws if a timer is already running elsewhere', () => {
    expect(() => assertCanStartSession(timer({}), record({}))).toThrow('Another timer is already running');
  });

  it('throws if there is no scheduled record for today', () => {
    expect(() => assertCanStartSession(null, undefined)).toThrow('no scheduled target for today');
  });

  it('throws if the day is already DONE', () => {
    expect(() => assertCanStartSession(null, record({ status: 'DONE' }))).toThrow('already complete');
  });

  it('does not throw when no timer is running and the record is available', () => {
    expect(() => assertCanStartSession(null, record({}))).not.toThrow();
  });
});

describe('startSession', () => {
  it('builds a running TimerState carrying forward the record baseline', () => {
    const session = startSession('c1', '2026-01-01', 500, 1000);
    expect(session).toEqual({
      id: 'current',
      commitmentId: 'c1',
      dayDate: '2026-01-01',
      status: 'running',
      baselineSeconds: 500,
      accumulatedSeconds: 0,
      runStartedAt: 1000,
    });
  });
});

describe('pauseSession / resumeSession', () => {
  it('folds the running segment into accumulatedSeconds on pause', () => {
    const running = timer({ runStartedAt: 1000, accumulatedSeconds: 10 });
    const paused = pauseSession(running, 1000 + 30_000);
    expect(paused.status).toBe('paused');
    expect(paused.accumulatedSeconds).toBeCloseTo(40, 5);
    expect(paused.runStartedAt).toBeNull();
  });

  it('is a no-op when the timer is not running', () => {
    const paused = timer({ status: 'paused', runStartedAt: null });
    expect(pauseSession(paused, 5000)).toBe(paused);
  });

  it('resumes a paused timer with a fresh runStartedAt', () => {
    const paused = timer({ status: 'paused', runStartedAt: null });
    const resumed = resumeSession(paused, 9999);
    expect(resumed.status).toBe('running');
    expect(resumed.runStartedAt).toBe(9999);
  });

  it('is a no-op when the timer is not paused', () => {
    const running = timer({ status: 'running' });
    expect(resumeSession(running, 5000)).toBe(running);
  });
});

describe('applyPauseToRecord', () => {
  it('caps elapsed seconds and marks the record PARTIAL when time was recorded', () => {
    const t = timer({ runStartedAt: null, status: 'paused', accumulatedSeconds: 600 });
    const updated = applyPauseToRecord(t, record({ targetSeconds: 3600 }), 0);
    expect(updated.elapsedSeconds).toBe(600);
    expect(updated.status).toBe('PARTIAL');
  });

  it('leaves the record status unchanged if capped elapsed is 0', () => {
    const t = timer({ runStartedAt: null, status: 'paused', accumulatedSeconds: 0 });
    const updated = applyPauseToRecord(t, record({ status: 'NOT_STARTED' }), 0);
    expect(updated.elapsedSeconds).toBe(0);
    expect(updated.status).toBe('NOT_STARTED');
  });
});

describe('applyStopToRecord', () => {
  it('marks the record DONE and stamps completedAt when the target is reached', () => {
    const t = timer({ runStartedAt: null, status: 'paused', accumulatedSeconds: 3600 });
    const updated = applyStopToRecord(t, record({ targetSeconds: 3600 }), 5000);
    expect(updated.elapsedSeconds).toBe(3600);
    expect(updated.status).toBe('DONE');
    expect(updated.completedAt).toBe(5000);
  });

  it('marks the record PARTIAL when target is not reached but time was recorded', () => {
    const t = timer({ runStartedAt: null, status: 'paused', accumulatedSeconds: 600 });
    const updated = applyStopToRecord(t, record({ targetSeconds: 3600 }), 5000);
    expect(updated.status).toBe('PARTIAL');
    expect(updated.completedAt).toBeUndefined();
  });

  it('preserves an existing completedAt rather than overwriting it', () => {
    const t = timer({ runStartedAt: null, status: 'paused', accumulatedSeconds: 3600 });
    const updated = applyStopToRecord(t, record({ targetSeconds: 3600, completedAt: 111 }), 5000);
    expect(updated.completedAt).toBe(111);
  });
});

describe('hasReachedTarget / applyAutoCompleteToRecord', () => {
  it('reports true once total elapsed reaches the target', () => {
    const t = timer({ runStartedAt: 0, accumulatedSeconds: 0 });
    expect(hasReachedTarget(t, record({ targetSeconds: 60 }), 60_000)).toBe(true);
    expect(hasReachedTarget(t, record({ targetSeconds: 60 }), 59_000)).toBe(false);
  });

  it('marks the record DONE with capped elapsed seconds on auto-complete', () => {
    const t = timer({ runStartedAt: 0, accumulatedSeconds: 0 });
    const updated = applyAutoCompleteToRecord(t, record({ targetSeconds: 60 }), 120_000);
    expect(updated.status).toBe('DONE');
    expect(updated.elapsedSeconds).toBe(60);
    expect(updated.completedAt).toBe(120_000);
  });
});

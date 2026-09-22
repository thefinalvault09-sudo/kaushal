import { beforeEach, describe, expect, it } from 'vitest';
import * as repo from './repository';
import { computeEndDate } from '../utils/date';

// fake-indexeddb persists per-process; reset relevant stores between tests
// so assertions don't leak across test cases.
beforeEach(async () => {
  await repo.resetAllData();
});

describe('repository: commitments + day records', () => {
  it('creates one day record for every scheduled day, inclusive of start and end', async () => {
    const commitment = await repo.createCommitment({
      name: 'Study Electronics',
      dailyTargetSeconds: 7200,
      durationDays: 7,
      startDate: '2026-01-01',
    });

    expect(commitment.endDate).toBe(computeEndDate('2026-01-01', 7));
    expect(commitment.endDate).toBe('2026-01-07');

    const records = await repo.listDayRecordsForCommitment(commitment.id);
    expect(records).toHaveLength(7);
    expect(records[0].date).toBe('2026-01-01');
    expect(records[6].date).toBe('2026-01-07');
    expect(records.every((r) => r.status === 'NOT_STARTED')).toBe(true);
    expect(records.every((r) => r.targetSeconds === 7200)).toBe(true);
  });

  it('persists data across repository calls (simulated refresh)', async () => {
    const commitment = await repo.createCommitment({
      name: 'Read Books',
      dailyTargetSeconds: 1800,
      durationDays: 3,
      startDate: '2026-02-01',
    });

    // Simulate a fresh load, as would happen after a page refresh.
    const reloaded = await repo.getCommitment(commitment.id);
    expect(reloaded).toBeDefined();
    expect(reloaded?.name).toBe('Read Books');

    const records = await repo.listDayRecordsForCommitment(commitment.id);
    expect(records).toHaveLength(3);
  });

  it('deleting a commitment removes its day records too', async () => {
    const commitment = await repo.createCommitment({
      name: 'Gym',
      dailyTargetSeconds: 3600,
      durationDays: 2,
      startDate: '2026-03-01',
    });

    await repo.deleteCommitment(commitment.id);

    expect(await repo.getCommitment(commitment.id)).toBeUndefined();
    expect(await repo.listDayRecordsForCommitment(commitment.id)).toHaveLength(0);
  });
});

describe('repository: completion-only tracking type', () => {
  it('defaults trackingType to DURATION when omitted, for backward compatibility', async () => {
    const commitment = await repo.createCommitment({
      name: 'Legacy habit',
      dailyTargetSeconds: 1800,
      durationDays: 2,
      startDate: '2026-06-01',
    });
    expect(repo.resolveTrackingType(commitment)).toBe('DURATION');
  });

  it('resolves a commitment with no trackingType field at all as DURATION', () => {
    const legacy = {
      id: 'x',
      name: 'Old',
      dailyTargetSeconds: 600,
      durationDays: 1,
      startDate: '2026-01-01',
      endDate: '2026-01-01',
      createdAt: 0,
    };
    expect(repo.resolveTrackingType(legacy)).toBe('DURATION');
  });

  it('creates a COMPLETION commitment with dailyTargetSeconds forced to 0, even if a nonzero value is passed', async () => {
    const commitment = await repo.createCommitment({
      name: 'Drink 3L Water',
      dailyTargetSeconds: 9999,
      durationDays: 4,
      startDate: '2026-06-10',
      trackingType: 'COMPLETION',
    });

    expect(commitment.trackingType).toBe('COMPLETION');
    expect(commitment.dailyTargetSeconds).toBe(0);

    const records = await repo.listDayRecordsForCommitment(commitment.id);
    expect(records).toHaveLength(4);
    expect(records.every((r) => r.targetSeconds === 0)).toBe(true);
    expect(records.every((r) => r.status === 'NOT_STARTED')).toBe(true);
  });

  it('completing then un-completing a day record round-trips through the repository', async () => {
    const commitment = await repo.createCommitment({
      name: 'Meditate',
      dailyTargetSeconds: 0,
      durationDays: 1,
      startDate: '2026-06-20',
      trackingType: 'COMPLETION',
    });
    const record = await repo.getDayRecord(commitment.id, '2026-06-20');
    expect(record).toBeDefined();

    await repo.saveDayRecord({ ...record!, status: 'DONE', completedAt: Date.now() });
    let updated = await repo.getDayRecord(commitment.id, '2026-06-20');
    expect(updated?.status).toBe('DONE');
    expect(updated?.elapsedSeconds).toBe(0);

    await repo.saveDayRecord({ ...updated!, status: 'NOT_STARTED', completedAt: undefined });
    updated = await repo.getDayRecord(commitment.id, '2026-06-20');
    expect(updated?.status).toBe('NOT_STARTED');
  });
});

describe('repository: timer state persistence', () => {
  it('saves and restores timer state (simulated refresh recovery)', async () => {
    const commitment = await repo.createCommitment({
      name: 'Coding',
      dailyTargetSeconds: 3600,
      durationDays: 1,
      startDate: '2026-04-01',
    });

    await repo.saveTimerState({
      id: 'current',
      commitmentId: commitment.id,
      dayDate: '2026-04-01',
      status: 'running',
      baselineSeconds: 0,
      accumulatedSeconds: 120,
      runStartedAt: Date.now(),
    });

    const restored = await repo.getTimerState();
    expect(restored).toBeDefined();
    expect(restored?.commitmentId).toBe(commitment.id);
    expect(restored?.accumulatedSeconds).toBe(120);

    await repo.clearTimerState();
    expect(await repo.getTimerState()).toBeUndefined();
  });
});

describe('repository: export / import', () => {
  it('round-trips a full export through import without data loss', async () => {
    await repo.createCommitment({
      name: 'Learn Python',
      dailyTargetSeconds: 3600,
      durationDays: 5,
      startDate: '2026-05-01',
    });

    const exported = await repo.exportAllData();
    expect(exported.commitments).toHaveLength(1);
    expect(exported.dayRecords).toHaveLength(5);

    await repo.resetAllData();
    expect(await repo.listCommitments()).toHaveLength(0);

    await repo.importAllData(exported);
    const imported = await repo.listCommitments();
    expect(imported).toHaveLength(1);
    expect(imported[0].name).toBe('Learn Python');
    expect(await repo.listAllDayRecords()).toHaveLength(5);
  });

  it('rejects an import payload that is not a valid export', async () => {
    await expect(repo.importAllData({ nonsense: true })).rejects.toThrow();
    await expect(repo.importAllData(null)).rejects.toThrow();
  });
});

describe('repository: reset', () => {
  it('permanently clears commitments, day records, and timer state', async () => {
    const commitment = await repo.createCommitment({
      name: 'Gym',
      dailyTargetSeconds: 3600,
      durationDays: 2,
      startDate: '2026-03-01',
    });
    await repo.saveTimerState({
      id: 'current',
      commitmentId: commitment.id,
      dayDate: '2026-03-01',
      status: 'running',
      baselineSeconds: 0,
      accumulatedSeconds: 0,
      runStartedAt: Date.now(),
    });

    await repo.resetAllData();

    expect(await repo.listCommitments()).toHaveLength(0);
    expect(await repo.listAllDayRecords()).toHaveLength(0);
    expect(await repo.getTimerState()).toBeUndefined();
  });
});

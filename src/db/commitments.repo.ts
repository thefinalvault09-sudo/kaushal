// Typed data-access functions for Commitments. Part of the repository layer
// — components never talk to IndexedDB directly, they go through here (or
// the sibling *.repo.ts files) via the db/repository.ts barrel.
//
// The actual "what does a new habit and its scheduled days look like"
// logic lives in domain/habit/creation.ts (buildHabit) — this module's job
// is purely persistence: build it, then save every piece.

import { STORES, getAll, getByIndex, getById, put, remove } from './db';
import type { Commitment, DayRecord } from '../types';
import { buildHabit, habitDayRecordId, type NewHabitInput } from '../domain/habit';

export async function listCommitments(): Promise<Commitment[]> {
  const all = await getAll<Commitment>(STORES.commitments);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getCommitment(id: string): Promise<Commitment | undefined> {
  return getById<Commitment>(STORES.commitments, id);
}

/** Alias kept for backward compatibility — existing call sites import this
 *  name from the repository layer. Same shape as domain/habit's NewHabitInput. */
export type NewCommitmentInput = NewHabitInput;

/** Creates a commitment and generates one DayRecord for every scheduled day. */
export async function createCommitment(input: NewCommitmentInput): Promise<Commitment> {
  const { habit, dayRecords } = buildHabit(input);

  await put(STORES.commitments, habit);
  for (const record of dayRecords) {
    await put(STORES.dayRecords, record);
  }

  return habit;
}

export async function deleteCommitment(id: string): Promise<void> {
  const records = await getByIndex<DayRecord>(STORES.dayRecords, 'commitmentId', id);
  for (const record of records) {
    await remove(STORES.dayRecords, record.id);
  }
  await remove(STORES.commitments, id);
}

/** `${commitmentId}_${date}` — the deterministic id for a commitment+day.
 *  Re-exported for backward compatibility; the canonical implementation now
 *  lives in domain/habit/creation.ts as habitDayRecordId(). */
export const dayRecordId = habitDayRecordId;

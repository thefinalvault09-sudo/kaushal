// Typed data-access functions for DayRecords.

import { STORES, getAll, getById, getByIndex, put } from './db';
import type { DayRecord } from '../types';
import { habitDayRecordId } from '../domain/habit';

export async function listDayRecordsForCommitment(commitmentId: string): Promise<DayRecord[]> {
  const records = await getByIndex<DayRecord>(STORES.dayRecords, 'commitmentId', commitmentId);
  return records.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getDayRecord(commitmentId: string, date: string): Promise<DayRecord | undefined> {
  return getById<DayRecord>(STORES.dayRecords, habitDayRecordId(commitmentId, date));
}

export async function listAllDayRecords(): Promise<DayRecord[]> {
  return getAll<DayRecord>(STORES.dayRecords);
}

export async function saveDayRecord(record: DayRecord): Promise<void> {
  await put(STORES.dayRecords, record);
}

// Full-data export/import/reset. Depends on the other *.repo.ts modules
// rather than db.ts directly, since it operates at the level of "all data"
// rather than a single store.

import { STORES, clearStore, put } from './db';
import type { ExportPayload } from '../types';
import { listCommitments } from './commitments.repo';
import { listAllDayRecords } from './dayRecords.repo';
import { getTimerState } from './timer.repo';
import { getSettings, withSettingsDefaults } from './settings.repo';

export async function exportAllData(): Promise<ExportPayload> {
  const [commitments, dayRecords, timerState, settings] = await Promise.all([
    listCommitments(),
    listAllDayRecords(),
    getTimerState(),
    getSettings(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    commitments,
    dayRecords,
    timerState: timerState ?? null,
    settings,
  };
}

/** Validates and imports an export payload, replacing existing data. */
export async function importAllData(payload: unknown): Promise<void> {
  if (!isExportPayload(payload)) {
    throw new Error('This file is not a valid Grit export.');
  }

  await resetAllData();

  for (const commitment of payload.commitments) {
    await put(STORES.commitments, commitment);
  }
  for (const record of payload.dayRecords) {
    await put(STORES.dayRecords, record);
  }
  if (payload.timerState) {
    await put(STORES.timerState, payload.timerState);
  }
  if (payload.settings) {
    // Back-fill any reminder/reset fields missing from an older export
    // (from before those fields existed) with their defaults, same as a
    // normal getSettings() read would.
    await put(STORES.settings, withSettingsDefaults(payload.settings));
  }
}

function isExportPayload(value: unknown): value is ExportPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    Array.isArray(v.commitments) &&
    Array.isArray(v.dayRecords)
  );
}

/** Permanently deletes all commitments, day records, and timer state.
 *  Settings (theme, notification pref) are preserved by design.
 *  Also used by importAllData() to clear existing data before restoring
 *  from a payload — the two operations need the exact same clear step. */
export async function resetAllData(): Promise<void> {
  await Promise.all([clearStore(STORES.commitments), clearStore(STORES.dayRecords), clearStore(STORES.timerState)]);
}

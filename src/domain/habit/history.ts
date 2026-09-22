// History: deriving a rich, presentation-only DisplayStatus for a scheduled
// day, and grouping a habit's day records into calendar weeks for history
// views. Nothing here is written back to storage — history stays
// append-only and factual. Moved verbatim from domain/status.ts (status
// logic) and utils/date.ts's groupByWeek (calendar layout) into
// domain/habit/ as part of consolidating all habit business logic under
// one module.

import type { DayRecord, DisplayStatus, TimerState } from '../../types';
import { isPast, parseISODate, toISODate } from '../../utils/date';

export function computeDisplayStatus(
  record: DayRecord,
  activeTimer?: TimerState | null,
  /** The user's configured daily-reset hour (Settings > Daily refresh
   *  time), 0-23. Defaults to 0 (midnight) — existing call sites that
   *  don't pass this keep their exact original behavior. */
  dailyResetHour = 0,
): DisplayStatus {
  const isThisRecordTimed =
    !!activeTimer &&
    activeTimer.commitmentId === record.commitmentId &&
    activeTimer.dayDate === record.date;

  if (record.status === 'DONE') {
    if (record.completedAt) {
      const completedDate = toISODate(new Date(record.completedAt));
      if (completedDate > record.date) return 'COMPLETED_LATE';
    }
    return 'DONE';
  }

  if (isThisRecordTimed && activeTimer!.status === 'running') {
    return 'IN_PROGRESS';
  }

  const dayIsOver = isPast(record.date, dailyResetHour);

  if (record.elapsedSeconds > 0) {
    return dayIsOver ? 'MISSED' : 'PARTIAL';
  }

  return dayIsOver ? 'MISSED' : 'NOT_STARTED';
}

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  NOT_STARTED: 'NOT STARTED',
  IN_PROGRESS: 'IN PROGRESS',
  PARTIAL: 'PARTIAL',
  DONE: 'DONE',
  COMPLETED_LATE: 'COMPLETED LATE',
  MISSED: 'MISSED',
};

/**
 * Groups a chronologically-sorted list of day records into calendar weeks
 * (Sun-Sat), padding leading/trailing gaps with `null` so a calendar grid
 * can render fixed 7-column rows.
 */
export function groupByWeek(records: DayRecord[]): (DayRecord | null)[][] {
  if (records.length === 0) return [];
  const weeks: (DayRecord | null)[][] = [];
  let currentWeek: (DayRecord | null)[] = [];

  const firstDow = parseISODate(records[0].date).getDay();
  for (let i = 0; i < firstDow; i++) currentWeek.push(null);

  for (const record of records) {
    currentWeek.push(record);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }
  return weeks;
}

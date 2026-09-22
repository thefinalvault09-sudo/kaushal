// Pure, factual progress calculations — no scoring, no gamification. Moved
// verbatim from domain/progress.ts into domain/habit/ as part of
// consolidating all habit business logic under one module.

import type { DayRecord } from '../../types';
import { isPast, isToday } from '../../utils/date';

export interface ProgressSummary {
  totalPlanned: number;
  completedDays: number;
  partialDays: number;
  missedDays: number;
  notStartedFuture: number;
  /** completedDays / totalPlanned, 0-100. */
  completionPercent: number;
  /** completedDays / (completedDays + partialDays + missedDays), 0-100.
   *  Only counts days whose window has already passed (or is done today),
   *  so future scheduled days don't drag this number down artificially. */
  consistencyPercent: number;
}

export function summarizeProgress(records: DayRecord[], dailyResetHour = 0): ProgressSummary {
  let completedDays = 0;
  let partialDays = 0;
  let missedDays = 0;
  let notStartedFuture = 0;

  for (const record of records) {
    const dayHasPassed = isPast(record.date, dailyResetHour) || isToday(record.date, dailyResetHour);

    if (record.status === 'DONE') {
      completedDays++;
      continue;
    }

    if (!dayHasPassed) {
      notStartedFuture++;
      continue;
    }

    if (isToday(record.date, dailyResetHour)) {
      // Today counts as partial-in-progress rather than missed until the
      // day actually elapses.
      if (record.elapsedSeconds > 0) {
        partialDays++;
      } else {
        notStartedFuture++;
      }
      continue;
    }

    // Past day, not DONE.
    if (record.elapsedSeconds > 0) {
      partialDays++;
    } else {
      missedDays++;
    }
  }

  const totalPlanned = records.length;
  const accountedForPast = completedDays + partialDays + missedDays;

  const completionPercent = totalPlanned > 0 ? Math.round((completedDays / totalPlanned) * 100) : 0;
  const consistencyPercent =
    accountedForPast > 0 ? Math.round((completedDays / accountedForPast) * 100) : 0;

  return {
    totalPlanned,
    completedDays,
    partialDays,
    missedDays,
    notStartedFuture,
    completionPercent,
    consistencyPercent,
  };
}

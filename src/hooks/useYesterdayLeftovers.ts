// Builds the "yesterday leftover" list for the Today screen: any commitment
// where yesterday's DayRecord isn't DONE yet, still shown so the user can
// pick it back up and finish it late.
//
// Mirrors useTodayItems in every detail except date — same filter shape,
// same deriveTodayItem output — so the Today screen can render both
// sections through the same TodayGroup/TodayCard components. The card's
// action buttons already accept an explicit `date` per row (see
// TodayCardControls), so resuming/completing hits the yesterday record
// specifically, not today's; a resulting DONE lands with
// completedAt = now, which history's computeDisplayStatus derives as
// COMPLETED_LATE.

import { useMemo } from 'react';
import { useApp, useNowMs } from '../context/AppContext';
import { deriveTodayItem, type TodayItem } from '../domain/habit';
import { addDays, todayISO } from '../utils/date';

export function useYesterdayLeftovers(): TodayItem[] {
  const { commitments, dayRecordFor, timer, settings } = useApp();
  const nowMs = useNowMs();
  const dailyResetHour = settings.dailyResetHour;
  const today = todayISO(dailyResetHour);
  const yesterday = addDays(today, -1);

  return useMemo<TodayItem[]>(() => {
    return commitments
      .filter((c) => c.startDate <= yesterday && yesterday <= c.endDate)
      .map((c) => {
        const record = dayRecordFor(c.id, yesterday);
        // No record for yesterday (shouldn't happen for an active
        // commitment, but guard defensively) — nothing to catch up.
        if (!record) return null;
        // Already DONE — either finished on the day or previously caught
        // up. Nothing to show; avoids a lingering "completed" card in the
        // leftover section.
        if (record.status === 'DONE') return null;
        return deriveTodayItem(c, record, yesterday, timer, nowMs, dailyResetHour);
      })
      .filter((v): v is TodayItem => v !== null);
  }, [commitments, dayRecordFor, yesterday, timer, nowMs, dailyResetHour]);
}

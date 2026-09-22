import { useApp } from '../../context/AppContext';
import { formatDuration, formatHoursMinutes, formatLongDate, formatShortDate, toISODate } from '../../utils/date';
import { computeDisplayStatus } from '../../domain/habit';
import StatusBadge from '../StatusBadge';
import type { DayRecord } from '../../types';

/** Detail panel for a single selected day in a commitment's history
 *  calendar. Extracted from screens/CommitmentDetail.tsx verbatim. */
export default function DayDetail({ record, isCompletion }: { record: DayRecord; isCompletion: boolean }) {
  const { timer, settings } = useApp();
  const status = computeDisplayStatus(record, timer, settings.dailyResetHour);
  return (
    <div className="day-detail-body">
      <p className="day-detail-date serif">{formatLongDate(record.date)}</p>
      <StatusBadge status={status} />
      {!isCompletion && (
        <>
          <div className="day-detail-row">
            <span className="label">Target</span> <span className="mono">{formatHoursMinutes(record.targetSeconds)}</span>
          </div>
          <div className="day-detail-row">
            <span className="label">Recorded</span> <span className="mono">{formatDuration(record.elapsedSeconds)}</span>
          </div>
        </>
      )}
      {record.completedAt && (
        <div className="day-detail-row">
          <span className="label">Completed</span> <span className="mono">{toISODate(new Date(record.completedAt))}</span>
        </div>
      )}
      {status === 'COMPLETED_LATE' && (
        <p className="day-detail-note">
          Originally scheduled for {formatShortDate(record.date)}. This day was not completed on time and
          cannot be marked as completed on schedule.
        </p>
      )}
    </div>
  );
}

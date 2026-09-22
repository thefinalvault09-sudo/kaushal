import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatLongDate, formatShortDate, parseISODate } from '../utils/date';
import { summarizeProgress, computeDisplayStatus, groupByWeek, resolveTrackingType, formatTrackingLabel } from '../domain/habit';
import FocusLens from '../components/FocusLens';
import DayDetail from '../components/commitmentDetail/DayDetail';
import Legend from '../components/commitmentDetail/Legend';
import { ArrowLeftIcon } from '../components/icons';
import type { DisplayStatus } from '../types';
import './CommitmentDetail.css';

const STATUS_DOT_CLASS: Record<DisplayStatus, string> = {
  NOT_STARTED: 'cal-neutral',
  IN_PROGRESS: 'cal-accent',
  PARTIAL: 'cal-warning',
  DONE: 'cal-success',
  COMPLETED_LATE: 'cal-late',
  MISSED: 'cal-danger',
};

export default function CommitmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { commitments, dayRecordsFor, timer, deleteCommitment, settings } = useApp();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const commitment = commitments.find((c) => c.id === id);
  const records = useMemo(() => (id ? dayRecordsFor(id) : []), [id, dayRecordsFor]);
  const summary = useMemo(
    () => summarizeProgress(records, settings.dailyResetHour),
    [records, settings.dailyResetHour],
  );

  if (!commitment) {
    return (
      <div className="lens commitment-detail-missing">
        <p>This commitment could not be found.</p>
        <Link to="/commitments" className="btn btn-primary">
          Back to Commitments
        </Link>
      </div>
    );
  }

  const weeks = groupByWeek(records);
  const selectedRecord = selectedDate ? records.find((r) => r.date === selectedDate) : undefined;
  const commitmentId = commitment.id;
  const trackingType = resolveTrackingType(commitment);
  const isCompletion = trackingType === 'COMPLETION';

  async function handleDelete() {
    await deleteCommitment(commitmentId);
    navigate('/commitments');
  }

  return (
    <div className="commitment-detail-screen">
      <Link to="/commitments" className="commitment-detail-back">
        <ArrowLeftIcon width={13} height={13} /> Commitments
      </Link>

      <header className="commitment-detail-header">
        <div className="commitment-detail-head-lead">
          <span className="eyebrow">Commitment</span>
          <h1 className="commitment-detail-title display">{commitment.name}</h1>
          <p className="commitment-detail-meta">
            {formatTrackingLabel(commitment)} · {commitment.durationDays} days ·{' '}
            {formatShortDate(commitment.startDate)} – {formatShortDate(commitment.endDate)}
          </p>
        </div>
        <FocusLens percent={summary.completionPercent} size={96} variant="round" state={summary.completionPercent === 100 ? 'done' : 'idle'}>
          <span className="commitment-detail-percent">{summary.completionPercent}%</span>
        </FocusLens>
      </header>

      <div className="commitment-detail-grid">
        <section className="lens commitment-detail-calendar">
          <div className="lens-head">
            <h2 className="label">History</h2>
            <span className="label">
              {summary.completedDays} / {summary.totalPlanned} days
            </span>
          </div>
          <div className="commitment-calendar-body">
            <div className="commitment-calendar-weekdays">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="commitment-calendar-week">
                {week.map((record, di) =>
                  record ? (
                    <button
                      key={record.date}
                      type="button"
                      className={`commitment-calendar-day ${STATUS_DOT_CLASS[computeDisplayStatus(record, timer, settings.dailyResetHour)]}${
                        selectedDate === record.date ? ' selected' : ''
                      }`}
                      onClick={() => setSelectedDate(record.date)}
                      aria-label={`${formatLongDate(record.date)}: ${computeDisplayStatus(record, timer, settings.dailyResetHour)}`}
                    >
                      {parseISODate(record.date).getDate()}
                    </button>
                  ) : (
                    <span key={di} className="commitment-calendar-day empty" aria-hidden="true" />
                  ),
                )}
              </div>
            ))}
          </div>
          <Legend />
        </section>

        <section className="lens commitment-detail-day">
          <div className="lens-head">
            <h2 className="label">Day detail</h2>
          </div>
          {selectedRecord ? (
            <DayDetail record={selectedRecord} isCompletion={isCompletion} />
          ) : (
            <p className="commitment-detail-day-empty">Select a droplet in the history to read its record.</p>
          )}
        </section>
      </div>

      <section className="commitment-detail-danger">
        {confirmingDelete ? (
          <div className="lens commitment-delete-confirm">
            <span>Delete this commitment and all its history? This cannot be undone.</span>
            <div className="commitment-delete-actions">
              <button type="button" className="btn btn-danger" onClick={handleDelete}>
                Delete permanently
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-danger" onClick={() => setConfirmingDelete(true)}>
            Delete commitment
          </button>
        )}
      </section>
    </div>
  );
}

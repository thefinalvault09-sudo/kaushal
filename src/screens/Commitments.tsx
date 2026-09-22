import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatShortDate, todayISO } from '../utils/date';
import { summarizeProgress, formatTrackingLabel, type ProgressSummary } from '../domain/habit';
import AnimatedNumber from '../components/AnimatedNumber';
import { ArrowRightIcon, TrashIcon } from '../components/icons';
import type { Commitment } from '../types';
import './Commitments.css';

export default function Commitments() {
  const { commitments, dayRecordsFor, settings, deleteCommitment } = useApp();
  const today = todayISO(settings.dailyResetHour);
  // Tracks which single row (by commitment id) currently shows its inline
  // "delete this?" confirmation. Only one at a time — opening a second
  // row's confirm implicitly closes any other, which reads more calmly
  // than several rows asking to be deleted at once.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      commitments.map((commitment) => {
        const records = dayRecordsFor(commitment.id);
        const summary = summarizeProgress(records, settings.dailyResetHour);
        const isActive = commitment.endDate >= today;
        return { commitment, summary, isActive };
      }),
    [commitments, dayRecordsFor, today, settings.dailyResetHour],
  );

  const active = rows.filter((r) => r.isActive);
  const completed = rows.filter((r) => !r.isActive);

  async function handleDelete(id: string) {
    // deleteCommitment already removes only this commitment's own day
    // records (dayRecords.filter by commitmentId) and clears the active
    // timer only if it belonged to this commitment — other commitments'
    // history and any unrelated running timer are untouched.
    await deleteCommitment(id);
    setConfirmingId(null);
  }

  return (
    <div className="commitments-screen">
      <header className="commitments-header">
        <div className="commitments-header-lead">
          <span className="eyebrow">Registry</span>
          <h1 className="commitments-title display">
            Every <span className="accent">promise</span> you keep
          </h1>
        </div>
        <Link to="/new-commitment" className="btn btn-primary">
          <span>New Commitment</span>
          <ArrowRightIcon width={16} height={16} />
        </Link>
      </header>

      <Section
        title="Active"
        count={active.length}
        rows={active}
        tone="active"
        emptyLabel="No active commitments."
        confirmingId={confirmingId}
        onRequestDelete={setConfirmingId}
        onConfirmDelete={handleDelete}
      />
      <Section
        title="Completed"
        count={completed.length}
        rows={completed}
        tone="complete"
        emptyLabel="No completed commitments yet."
        confirmingId={confirmingId}
        onRequestDelete={setConfirmingId}
        onConfirmDelete={handleDelete}
      />
    </div>
  );
}

function Section({
  title,
  count,
  rows,
  tone,
  emptyLabel,
  confirmingId,
  onRequestDelete,
  onConfirmDelete,
}: {
  title: string;
  count: number;
  tone: 'active' | 'complete';
  rows: { commitment: Commitment; summary: ProgressSummary }[];
  emptyLabel: string;
  confirmingId: string | null;
  onRequestDelete: (id: string | null) => void;
  onConfirmDelete: (id: string) => void | Promise<void>;
}) {
  return (
    <section className="commitments-section">
      <div className={`commitments-section-head tone-${tone}`}>
        <h2 className="label commitments-section-title">{title}</h2>
        <span className="commitments-section-count mono">{count}</span>
        <span className="commitments-section-rule" aria-hidden="true" />
      </div>
      {rows.length === 0 ? (
        <div className="lens commitments-empty">{emptyLabel}</div>
      ) : (
        <div className="commitments-list stagger">
          {rows.map(({ commitment, summary }, idx) => {
            const isConfirming = confirmingId === commitment.id;
            return (
              <div
                key={commitment.id}
                className={`lens commitment-row tone-${tone}${isConfirming ? ' confirming' : ''}`}
                style={{ ['--i' as string]: idx }}
              >
                <Link to={`/commitments/${commitment.id}`} className="commitment-row-link">
                  <div className="commitment-row-main">
                    <div className="commitment-row-name serif">{commitment.name}</div>
                    <div className="commitment-row-meta">
                      {formatTrackingLabel(commitment)} · {commitment.durationDays} days ·{' '}
                      {formatShortDate(commitment.startDate)} – {formatShortDate(commitment.endDate)}
                    </div>
                    <div className="commitment-row-track" aria-hidden="true">
                      <div
                        className={`commitment-row-fill${summary.completionPercent === 100 ? ' full' : ''}`}
                        style={{ transform: `scaleX(${summary.completionPercent / 100})` }}
                      />
                    </div>
                  </div>
                  <div className="commitment-row-progress">
                    <div className="commitment-row-percent mono">
                      <AnimatedNumber value={summary.completionPercent} suffix="%" />
                    </div>
                    <div className="label commitment-row-days">
                      {summary.completedDays} / {summary.totalPlanned} days
                    </div>
                  </div>
                  <span className="commitment-row-chevron" aria-hidden="true">
                    <ArrowRightIcon width={16} height={16} />
                  </span>
                </Link>

                <button
                  type="button"
                  className="commitment-row-delete"
                  aria-label={`Delete ${commitment.name}`}
                  onClick={() => onRequestDelete(commitment.id)}
                >
                  <TrashIcon width={15} height={15} />
                </button>

                {isConfirming && (
                  <div className="commitment-row-confirm" role="alertdialog" aria-label="Confirm delete">
                    <span>
                      Delete <strong>{commitment.name}</strong> and all its history? This cannot be undone.
                    </span>
                    <div className="commitment-row-confirm-actions">
                      <button type="button" className="btn btn-danger" onClick={() => void onConfirmDelete(commitment.id)}>
                        Delete permanently
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => onRequestDelete(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

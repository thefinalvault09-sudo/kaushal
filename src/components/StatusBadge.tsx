import type { DisplayStatus } from '../types';
import { STATUS_LABELS } from '../domain/habit';
import './StatusBadge.css';

const STATUS_TONE: Record<DisplayStatus, string> = {
  NOT_STARTED: 'tone-neutral',
  IN_PROGRESS: 'tone-accent',
  PARTIAL: 'tone-warning',
  DONE: 'tone-positive',
  COMPLETED_LATE: 'tone-late',
  MISSED: 'tone-danger',
};

export default function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <span className={`status-pill aqua ${STATUS_TONE[status]}`}>
      <span className="bead" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}

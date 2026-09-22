import { memo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatDuration, formatHoursMinutes } from '../../utils/date';
import type { TodayItem } from '../../domain/habit';
import StatusBadge from '../StatusBadge';
import FocusLens from '../FocusLens';
import { CheckIcon, PauseIcon, PlayIcon, StopIcon } from '../icons';

export interface TodayCardControls {
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  stopTimer: () => Promise<void>;
  handleStart: (id: string) => Promise<void>;
  handleToggleComplete: (id: string) => Promise<void>;
}

interface TodayCardProps {
  item: TodayItem;
  controls: TodayCardControls;
  timer: ReturnType<typeof useApp>['timer'];
  index: number;
  compact?: boolean;
}

/**
 * `items` is rebuilt with a fresh array + fresh per-row objects every render
 * of Today() (it must be, to recompute the running timer's live elapsed
 * seconds each tick) — so a plain reference check would re-render every
 * visible card every second even though most of them show unchanged data.
 * This comparator instead checks the actual values that affect a card's
 * rendered output, so cards unrelated to whichever commitment is currently
 * timed skip re-rendering entirely while the clock ticks.
 */
function todayCardPropsEqual(prev: TodayCardProps, next: TodayCardProps): boolean {
  if (prev.controls !== next.controls || prev.timer !== next.timer || prev.index !== next.index || prev.compact !== next.compact) {
    return false;
  }
  const a = prev.item;
  const b = next.item;
  return (
    a.commitment === b.commitment &&
    a.record === b.record &&
    a.trackingType === b.trackingType &&
    a.status === b.status &&
    a.liveElapsed === b.liveElapsed &&
    a.remaining === b.remaining &&
    a.percent === b.percent &&
    a.isTimedHere === b.isTimedHere
  );
}

/** A single row in the Today screen's trail. Extracted from
 *  screens/Today.tsx verbatim (same markup, same branching). Memoized with
 *  a value-based comparator so unaffected cards skip re-rendering while
 *  whichever commitment is actively timed updates each second. */
const TodayCard = memo(function TodayCard({ item, controls, timer, index, compact }: TodayCardProps) {
  const { commitment, trackingType, record, status, liveElapsed, remaining, percent, isTimedHere } = item;
  const isCompletion = trackingType === 'COMPLETION';
  const anotherTimerRunning = !!timer && !isTimedHere;
  const done = status === 'DONE' || status === 'COMPLETED_LATE';
  const lensState = done ? 'done' : isTimedHere && timer?.status === 'running' ? 'running' : 'idle';

  return (
    <div
      className={`today-card lens tone-${done ? 'complete' : isTimedHere ? 'progress' : 'attention'}`}
      style={{ ['--i' as string]: index }}
    >
      <div className="today-card-lens">
        {isCompletion ? (
          <span className={`today-card-check${done ? ' done' : ''}`} aria-hidden="true">
            <CheckIcon width={20} height={20} />
          </span>
        ) : (
          <FocusLens percent={percent} size={52} variant="drop" state={lensState}>
            <span className="today-card-lens-num">{Math.round(percent)}</span>
          </FocusLens>
        )}
      </div>

      <div className="today-card-main">
        <div className="today-card-head">
          <Link to={`/commitments/${commitment.id}`} className="today-card-name serif">
            {commitment.name}
          </Link>
          <StatusBadge status={status} />
        </div>

        {!isCompletion && (
          <div className="today-card-meta">
            <span>Target <b className="mono">{formatHoursMinutes(record.targetSeconds)}</b></span>
            <span className="today-card-dot" aria-hidden="true" />
            <span>Elapsed <b className="mono">{formatDuration(liveElapsed)}</b></span>
            {!done && (
              <>
                <span className="today-card-dot" aria-hidden="true" />
                <span>Left <b className="mono">{formatDuration(remaining)}</b></span>
              </>
            )}
          </div>
        )}

        {!isCompletion && !compact && (
          <div
            className="today-fluid-track"
            role="progressbar"
            aria-valuenow={Math.round(percent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${commitment.name} progress`}
          >
            <div className={`today-fluid-fill${done ? ' done' : ''}`} style={{ transform: `scaleX(${percent / 100})` }} />
          </div>
        )}
      </div>

      <TodayCardButtons
        item={item}
        controls={controls}
        isTimerRunningHere={isTimedHere && timer?.status === 'running'}
        isTimerPausedHere={isTimedHere && timer?.status === 'paused'}
        anotherTimerRunning={anotherTimerRunning}
      />
    </div>
  );
}, todayCardPropsEqual);

export default TodayCard;

/**
 * The action-button area of a Today card. Split out of the same 5-way
 * branch that used to live inline in TodayCard (Completion-done /
 * Completion-pending / done / timer-running / timer-paused / idle) so each
 * case reads as its own early return instead of a deeply nested ternary —
 * same rendered output, easier to scan and modify safely.
 */
function TodayCardButtons({
  item,
  controls,
  isTimerRunningHere,
  isTimerPausedHere,
  anotherTimerRunning,
}: {
  item: TodayItem;
  controls: TodayCardControls;
  isTimerRunningHere: boolean;
  isTimerPausedHere: boolean;
  anotherTimerRunning: boolean;
}) {
  const { commitment, trackingType, status, isTimedHere } = item;
  const isCompletion = trackingType === 'COMPLETION';
  const done = status === 'DONE' || status === 'COMPLETED_LATE';

  if (isCompletion) {
    return (
      <div className="today-card-buttons">
        <button
          type="button"
          className={`btn today-btn-sm${done ? ' btn-ghost today-btn-completed' : ' btn-primary'}`}
          onClick={() => void controls.handleToggleComplete(commitment.id)}
        >
          <CheckIcon width={13} height={13} /> {done ? 'Completed' : 'Complete'}
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="today-card-buttons">
        <Link to="/progress" className="btn btn-ghost today-btn-sm">
          Progress
        </Link>
      </div>
    );
  }

  if (isTimerRunningHere) {
    return (
      <div className="today-card-buttons">
        <button type="button" className="btn btn-ghost today-btn-sm" onClick={() => void controls.pauseTimer()}>
          <PauseIcon width={13} height={13} /> Pause
        </button>
        <button type="button" className="btn btn-danger today-btn-sm" onClick={() => void controls.stopTimer()}>
          <StopIcon width={13} height={13} /> Stop
        </button>
        <Link to="/timer" className="btn btn-ghost today-btn-sm">
          Lens
        </Link>
      </div>
    );
  }

  if (isTimerPausedHere) {
    return (
      <div className="today-card-buttons">
        <button type="button" className="btn btn-primary today-btn-sm" onClick={() => void controls.resumeTimer()}>
          <PlayIcon width={13} height={13} /> Resume
        </button>
        <button type="button" className="btn btn-danger today-btn-sm" onClick={() => void controls.stopTimer()}>
          <StopIcon width={13} height={13} /> Stop
        </button>
        <Link to="/timer" className="btn btn-ghost today-btn-sm">
          Lens
        </Link>
      </div>
    );
  }

  return (
    <div className="today-card-buttons">
      <button
        type="button"
        className="btn btn-primary today-btn-sm"
        onClick={() => void controls.handleStart(commitment.id)}
        disabled={anotherTimerRunning}
        title={anotherTimerRunning ? 'Stop the active current first' : undefined}
      >
        <PlayIcon width={13} height={13} /> Start
      </button>
      {isTimedHere && (
        <Link to="/timer" className="btn btn-ghost today-btn-sm">
          Lens
        </Link>
      )}
    </div>
  );
}

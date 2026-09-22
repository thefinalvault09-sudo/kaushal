import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useNowMs } from '../context/AppContext';
import { deriveTodayItem } from '../domain/habit';
import { formatDuration, formatHoursMinutes, formatLongDate } from '../utils/date';
import FocusLens from '../components/FocusLens';
import { ArrowLeftIcon, CheckIcon, PauseIcon, PlayIcon, StopIcon } from '../components/icons';
import './Timer.css';

const CAPTIONS = {
  running: 'The current is flowing. Stay in it.',
  paused: 'Held still. Return when you are ready.',
  done: 'The lens is full. Consistency builds freedom.',
} as const;

export default function Timer() {
  const { timer, commitments, dayRecordFor, pauseTimer, resumeTimer, stopTimer } = useApp();
  const nowMs = useNowMs();
  const navigate = useNavigate();
  const [confirmingStop, setConfirmingStop] = useState(false);

  const commitment = useMemo(
    () => (timer ? commitments.find((c) => c.id === timer.commitmentId) : undefined),
    [timer, commitments],
  );
  const record = timer ? dayRecordFor(timer.commitmentId, timer.dayDate) : undefined;

  if (!timer || !commitment || !record) {
    return (
      <div className="timer-screen timer-empty">
        <div className="lens timer-empty-card">
          <span className="eyebrow">Still water</span>
          <p className="timer-empty-copy">No current is running right now. Begin one from Today.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/today')}>
            Go to Today
          </button>
        </div>
      </div>
    );
  }

  // Shares its elapsed/remaining/percent math with the Today screen's cards
  // via deriveTodayItem — the timer only ever runs for DURATION commitments,
  // so its percent formula here is exactly the DURATION branch of that helper.
  const { liveElapsed: elapsed, remaining, percent } = deriveTodayItem(commitment, record, timer.dayDate, timer, nowMs);
  const isRunning = timer.status === 'running';
  const isDone = record.status === 'DONE';
  const state = isDone ? 'done' : isRunning ? 'running' : 'paused';

  return (
    <div className={`timer-screen timer-state-${state}`}>
      <div className="timer-topbar">
        <button type="button" className="btn btn-ghost timer-back-btn" onClick={() => navigate('/today')}>
          <ArrowLeftIcon width={13} height={13} /> Today
        </button>
        <span className="timer-topbar-date label">{formatLongDate(timer.dayDate)}</span>
      </div>

      <div className="timer-stage">
        <div className="timer-heading">
          <span className={`status-pill aqua timer-state-pill state-${state}`}>
            <span className="bead" aria-hidden="true" />
            {isDone ? 'Complete' : isRunning ? 'Flowing' : 'On hold'}
          </span>
          <h1 className="timer-context serif">{commitment.name}</h1>
        </div>

        <div className="timer-instrument">
          <FocusLens percent={percent} size={306} variant="drop" state={state}>
            <span className="timer-elapsed mono" aria-live="polite">
              {formatDuration(elapsed)}
            </span>
            <span className="timer-target mono">of {formatHoursMinutes(record.targetSeconds)}</span>
            <span className={`timer-percent-badge${isDone ? ' done' : ''}`}>
              {isDone ? (
                <>
                  <CheckIcon width={12} height={12} /> 100%
                </>
              ) : (
                `${Math.round(percent)}% filled`
              )}
            </span>
          </FocusLens>
        </div>

        <div className="timer-readouts lens">
          <Readout label="Elapsed" value={formatDuration(elapsed)} live={isRunning} />
          <span className="timer-readout-sep" aria-hidden="true" />
          <Readout label="Target" value={formatHoursMinutes(record.targetSeconds)} />
          <span className="timer-readout-sep" aria-hidden="true" />
          <Readout label="Remaining" value={isDone ? '—' : formatDuration(remaining)} />
        </div>

        {isDone ? (
          <div className="timer-done-actions">
            <div className="lens timer-done-panel">
              <span className="timer-done-check" aria-hidden="true">
                <CheckIcon width={18} height={18} />
              </span>
              <div>
                <div className="timer-done-title serif">Daily target completed</div>
                <div className="timer-done-sub">Capped at 100% — bonus time never over-counts.</div>
              </div>
            </div>
            <div className="timer-controls">
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/today')}>
                Back to Today
              </button>
              <button type="button" className="btn btn-primary" onClick={() => navigate('/progress')}>
                View progress
              </button>
            </div>
          </div>
        ) : (
          <div className="timer-controls">
            {isRunning ? (
              <button type="button" className="btn btn-ghost btn-large timer-ctrl" onClick={() => void pauseTimer()}>
                <PauseIcon width={15} height={15} /> Pause
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-large timer-ctrl" onClick={() => void resumeTimer()}>
                <PlayIcon width={15} height={15} /> Resume
              </button>
            )}
            {confirmingStop ? (
              <div className="lens timer-stop-confirm">
                <span className="label">Stop and save this current?</span>
                <div className="timer-stop-confirm-actions">
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      void stopTimer();
                      setConfirmingStop(false);
                    }}
                  >
                    Confirm stop
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirmingStop(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn-danger btn-large timer-ctrl" onClick={() => setConfirmingStop(true)}>
                <StopIcon width={14} height={14} /> Stop
              </button>
            )}
          </div>
        )}

        <p className="timer-caption accent">{CAPTIONS[state]}</p>
      </div>
    </div>
  );
}

function Readout({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="timer-readout">
      <span className="timer-readout-label label">{label}</span>
      <span className={`timer-readout-value mono${live ? ' live' : ''}`}>{value}</span>
    </div>
  );
}

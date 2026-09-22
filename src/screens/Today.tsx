import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatLongDate, todayISO } from '../utils/date';
import { capitalizeFirstLetter, getStoredUserName } from '../utils/userName';
import { useTodayItems } from '../hooks/useTodayItems';
import { useYesterdayLeftovers } from '../hooks/useYesterdayLeftovers';
import FocusLens from '../components/FocusLens';
import AnimatedNumber from '../components/AnimatedNumber';
import TodayGroup from '../components/today/TodayGroup';
import TodayEmpty from '../components/today/TodayEmpty';
import { CloseIcon } from '../components/icons';
import './Today.css';

export default function Today() {
  const { timer, startTimer, pauseTimer, resumeTimer, stopTimer, toggleDayCompletion, error, dismissError, settings } =
    useApp();
  const [actionError, setActionError] = useState<string | null>(null);
  const today = todayISO(settings.dailyResetHour);
  const items = useTodayItems();
  const yesterdayLeftovers = useYesterdayLeftovers();

  // Operational grouping: what needs attention -> what is in progress -> what is complete.
  // `items` is a fresh array every render (see useTodayItems), including
  // every timer tick, so these three filter passes re-ran unconditionally
  // on every tick regardless of whether any item's status actually changed.
  // Memoizing on `items` itself keeps that cheap: recomputes only when the
  // items array reference actually changes (which useTodayItems only
  // produces when commitments/records/timer truly changed), not on every
  // render this component happens to do for other reasons.
  const { complete, inProgress, needsAttention } = useMemo(() => {
    const complete = items.filter((i) => i.status === 'DONE' || i.status === 'COMPLETED_LATE');
    const inProgress = items.filter((i) => i.isTimedHere && i.status !== 'DONE' && i.status !== 'COMPLETED_LATE');
    const needsAttention = items.filter(
      (i) => !i.isTimedHere && i.status !== 'DONE' && i.status !== 'COMPLETED_LATE',
    );
    return { complete, inProgress, needsAttention };
  }, [items]);

  const total = items.length;
  const completedCount = complete.length;
  const completionPercent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  // The header greeting leads with the user's own name (normalized to
  // first-letter-uppercase) instead of the literal word "Today". Falls back
  // to "Today" only if no name was ever captured during onboarding.
  const displayName = capitalizeFirstLetter(getStoredUserName()) || 'Today';

  // The empty/welcome state is designed to sit within a single viewport, so
  // lock page scrolling entirely while the list is empty — it must not
  // scroll "even 1cm". As soon as real commitments fill (and overflow) the
  // screen, `total` becomes > 0, the class is removed, and normal scrolling
  // returns. The class lives on <html> and is cleaned up on unmount too.
  const isEmpty = total === 0;
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('welcome-locked', isEmpty);
    return () => root.classList.remove('welcome-locked');
  }, [isEmpty]);

  const handleStart = useCallback(
    async (commitmentId: string, date: string) => {
      // `date` comes from the card's own record: today's cards pass
      // today's ISO, the "Yesterday leftover" section passes yesterday's
      // ISO. Whichever date is passed becomes the timer session's dayDate,
      // so the elapsed time accrues onto that specific day's record.
      setActionError(null);
      try {
        await startTimer(commitmentId, date);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Could not start the timer.');
      }
    },
    [startTimer],
  );

  const handleToggleComplete = useCallback(
    async (commitmentId: string, date: string) => {
      setActionError(null);
      try {
        await toggleDayCompletion(commitmentId, date);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Could not update this habit.');
      }
    },
    [toggleDayCompletion],
  );

  // Stable object identity across ticks (all inputs are already useCallback
  // with stable deps) so memoized TodayCards below don't get invalidated by
  // a "new controls object" on every render — only real prop changes do.
  const controls = useMemo(
    () => ({ pauseTimer, resumeTimer, stopTimer, handleStart, handleToggleComplete }),
    [pauseTimer, resumeTimer, stopTimer, handleStart, handleToggleComplete],
  );

  return (
    <div className={`today-screen${isEmpty ? ' today-screen--empty' : ''}`}>
      <header className="today-header">
        <div className="today-header-lead">
          <span className="eyebrow">{formatLongDate(today)}</span>
          <h1 className="today-title display">
            {displayName},<br />
            <em className="accent">find your clear current.</em>
          </h1>
        </div>
        {total > 0 && (
          <div className="today-header-meter">
            <div className="today-meter-num">
              <AnimatedNumber value={completedCount} /> / {total}
            </div>
            <span className="label">complete</span>
            <div className="today-meter-track" aria-hidden="true">
              <div className="today-meter-fill" style={{ transform: `scaleX(${completionPercent / 100})` }} />
            </div>
          </div>
        )}
      </header>

      {(error || actionError) && (
        <div className="today-error lens" role="alert">
          <span>{actionError ?? error}</span>
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => {
              setActionError(null);
              dismissError();
            }}
            aria-label="Dismiss error"
          >
            <CloseIcon width={12} height={12} />
          </button>
        </div>
      )}

      {total === 0 ? (
        <TodayEmpty />
      ) : (
        <div className="today-layout">
          <div className="today-main">
            {timer ? (
              <>
                <TodayGroup title="In progress" tone="progress" items={inProgress} controls={controls} timer={timer} />
                <TodayGroup title="Needs attention" tone="attention" items={needsAttention} controls={controls} timer={timer} />
              </>
            ) : (
              <>
                <TodayGroup title="Needs attention" tone="attention" items={needsAttention} controls={controls} timer={timer} />
                <TodayGroup title="In progress" tone="progress" items={inProgress} controls={controls} timer={timer} />
              </>
            )}
            <TodayGroup title="Complete" tone="complete" items={complete} controls={controls} timer={timer} collapsedMeta />
            {/* Yesterday's leftovers appear last, below Complete, so
               today's work is always the visual focus. Only rendered when
               there's actually something to catch up on — TodayGroup
               returns null for empty items and the section vanishes. */}
            <TodayGroup title="Yesterday" tone="attention" items={yesterdayLeftovers} controls={controls} timer={timer} collapsedMeta />
          </div>

          <aside className="today-context" aria-label="Daily status">
            <div className="lens today-status-card">
              <FocusLens percent={completionPercent} size={132} variant="round" state={completionPercent === 100 ? 'done' : 'idle'}>
                <span className="today-status-percent">
                  <AnimatedNumber value={completionPercent} suffix="%" />
                </span>
                <span className="label">of today</span>
              </FocusLens>
              <div className="today-status-caption">
                {completedCount} of {total} commitments complete
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

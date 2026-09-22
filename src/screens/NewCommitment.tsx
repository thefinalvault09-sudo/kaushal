import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { computeEndDate, formatLongDate, todayISO } from '../utils/date';
import { validateCommitmentForm, type CommitmentFormErrors } from '../domain/habit';
import { ArrowRightIcon } from '../components/icons';
import './NewCommitment.css';

export default function NewCommitment() {
  const { createCommitment, settings } = useApp();
  const navigate = useNavigate();

  const [trackingType, setTrackingType] = useState<'DURATION' | 'COMPLETION'>('DURATION');
  const [name, setName] = useState('');
  const [hours, setHours] = useState('1');
  const [minutes, setMinutes] = useState('0');
  const [duration, setDuration] = useState('30');
  const [startDate, setStartDate] = useState(() => todayISO(settings.dailyResetHour));
  const [errors, setErrors] = useState<CommitmentFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isCompletion = trackingType === 'COMPLETION';
  const hoursNum = Number(hours);
  const minutesNum = Number(minutes);
  const durationNum = Number(duration);
  const dailyTargetSeconds = isCompletion ? 0 : (hoursNum || 0) * 3600 + (minutesNum || 0) * 60;
  const previewEndDate =
    startDate && durationNum > 0 ? computeEndDate(startDate, durationNum) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationErrors = validateCommitmentForm({ name, trackingType, hours, minutes, duration, startDate });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const commitment = await createCommitment({
        name: name.trim(),
        dailyTargetSeconds,
        durationDays: durationNum,
        startDate,
        trackingType,
      });
      navigate(`/commitments/${commitment.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not create the commitment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="new-commitment-screen">
      <header className="new-commitment-head">
        <span className="eyebrow">Define</span>
        <h1 className="new-commitment-title display">
          A new <span className="accent">commitment</span>
        </h1>
        <p className="new-commitment-sub">A promise, measured in days and minutes.</p>
      </header>

      <form className="lens new-commitment-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="label" htmlFor="name">
            Commitment Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Study Electronics"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
          {errors.name && (
            <span id="name-error" className="field-error">
              {errors.name}
            </span>
          )}
        </div>

        <div className="field">
          <label className="label" htmlFor="trackingType">
            Tracking Type
          </label>
          <div className="new-commitment-type-row" role="radiogroup" aria-label="Tracking Type">
            <button
              type="button"
              role="radio"
              aria-checked={!isCompletion}
              className={`new-commitment-type-option${!isCompletion ? ' active' : ''}`}
              onClick={() => setTrackingType('DURATION')}
            >
              Duration
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={isCompletion}
              className={`new-commitment-type-option${isCompletion ? ' active' : ''}`}
              onClick={() => setTrackingType('COMPLETION')}
            >
              Completion
            </button>
          </div>
        </div>

        {isCompletion ? (
          <p className="new-commitment-completion-hint">
            No timer — just a simple <strong>Complete</strong> tap once per day.
          </p>
        ) : (
          <div className="field">
            <label className="label" htmlFor="hours">
              Daily Target
            </label>
            <div className="new-commitment-duration-row">
              <select id="hours" value={hours} onChange={(e) => setHours(e.target.value)} aria-label="Hours">
                {Array.from({ length: 13 }, (_, i) => i).map((h) => (
                  <option key={h} value={h}>
                    {h} hr
                  </option>
                ))}
              </select>
              <select value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="Minutes">
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </div>
            {(errors.hours || errors.minutes) && (
              <span className="field-error">{errors.hours ?? errors.minutes}</span>
            )}
          </div>
        )}

        <div className="field">
          <label className="label" htmlFor="duration">
            Duration (days)
          </label>
          <input
            id="duration"
            type="number"
            min={1}
            step={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            aria-invalid={!!errors.duration}
            aria-describedby={errors.duration ? 'duration-error' : undefined}
          />
          {errors.duration && (
            <span id="duration-error" className="field-error">
              {errors.duration}
            </span>
          )}
        </div>

        <div className="field">
          <label className="label" htmlFor="startDate">
            Start Date
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-invalid={!!errors.startDate}
            aria-describedby={errors.startDate ? 'start-error' : undefined}
          />
          {errors.startDate && (
            <span id="start-error" className="field-error">
              {errors.startDate}
            </span>
          )}
        </div>

        {previewEndDate && (
          <div className="new-commitment-preview">
            <span className="new-commitment-preview-tag eyebrow">Scheduled</span>
            <span className="new-commitment-preview-range">
              <span className="mono">{formatLongDate(startDate)}</span>
              <ArrowRightIcon width={15} height={15} />
              <span className="mono">{formatLongDate(previewEndDate)}</span>
            </span>
          </div>
        )}

        {submitError && <div className="field-error">{submitError}</div>}

        <div className="new-commitment-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Start Commitment'}
          </button>
        </div>
      </form>
    </div>
  );
}

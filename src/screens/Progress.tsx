import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { summarizeProgress } from '../domain/habit';
import { formatShortDate } from '../utils/date';
import FocusLens from '../components/FocusLens';
import AnimatedNumber from '../components/AnimatedNumber';
import AquaSelect from '../components/AquaSelect';
import './Progress.css';

export default function Progress() {
  const { commitments, dayRecords, dayRecordsFor, settings } = useApp();
  const [selectedId, setSelectedId] = useState<string>('all');

  const scopedRecords = selectedId === 'all' ? dayRecords : dayRecordsFor(selectedId);
  const scopedSummary = useMemo(
    () => summarizeProgress(scopedRecords, settings.dailyResetHour),
    [scopedRecords, settings.dailyResetHour],
  );

  const filterOptions = useMemo(
    () => [{ value: 'all', label: 'Overall progress' }, ...commitments.map((c) => ({ value: c.id, label: c.name }))],
    [commitments],
  );

  const recentDays = useMemo(() => {
    return [...scopedRecords].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  }, [scopedRecords]);

  const maxSeconds = Math.max(1, ...recentDays.map((r) => r.targetSeconds));
  const complete = scopedSummary.completionPercent === 100;

  return (
    <div className="progress-screen">
      <header className="progress-header">
        <div className="progress-header-lead">
          <span className="eyebrow">Analysis</span>
          <h1 className="progress-title display">
            Your <em className="accent">progress.</em>
          </h1>
        </div>
        <AquaSelect
          className="progress-select"
          value={selectedId}
          options={filterOptions}
          onChange={setSelectedId}
          ariaLabel="Filter by commitment"
        />
      </header>

      <div className="progress-top-grid">
        <div className="lens progress-ring-card">
          <div className="progress-rings">
            <div className="progress-ring-unit">
              <FocusLens percent={scopedSummary.completionPercent} size={128} variant="round" state={complete ? 'done' : 'idle'}>
                <span className="progress-ring-value">
                  <AnimatedNumber value={scopedSummary.completionPercent} suffix="%" />
                </span>
                <span className="label">done</span>
              </FocusLens>
              <span className="label progress-ring-caption">Completion</span>
            </div>
            <div className="progress-ring-unit">
              <FocusLens percent={scopedSummary.consistencyPercent} size={128} variant="round">
                <span className="progress-ring-value">
                  <AnimatedNumber value={scopedSummary.consistencyPercent} suffix="%" />
                </span>
                <span className="label">kept</span>
              </FocusLens>
              <span className="label progress-ring-caption">Consistency</span>
            </div>
          </div>
          <div className="progress-ring-sub">
            {scopedSummary.completedDays} of {scopedSummary.totalPlanned} planned days complete
          </div>
        </div>

        <div className="lens progress-stat-list">
          <div className="lens-head">
            <span className="label">Breakdown</span>
          </div>
          <StatRow label="Total planned days" value={scopedSummary.totalPlanned} />
          <StatRow label="Completed" value={scopedSummary.completedDays} accent="positive" />
          <StatRow label="Partial" value={scopedSummary.partialDays} accent="warning" />
          <StatRow label="Missed" value={scopedSummary.missedDays} accent="danger" />
        </div>
      </div>

      <section className="lens progress-chart-card">
        <div className="lens-head">
          <h2 className="label">Last 30 scheduled days</h2>
          <span className="label">recorded vs target</span>
        </div>
        <div className="progress-chart">
          {recentDays.length === 0 ? (
            <p className="progress-chart-empty">No scheduled days yet.</p>
          ) : (
            recentDays.map((record, idx) => {
              const heightPercent = Math.max(3, Math.min(100, (record.elapsedSeconds / maxSeconds) * 100));
              const barClass =
                record.status === 'DONE' ? 'bar-done' : record.elapsedSeconds > 0 ? 'bar-partial' : 'bar-none';
              return (
                <div
                  key={record.id}
                  className="progress-bar-col"
                  style={{ ['--i' as string]: idx }}
                  title={`${formatShortDate(record.date)} — ${record.status}`}
                >
                  <div className="progress-bar-track">
                    <div className={`progress-bar-fill ${barClass}`} style={{ height: `${heightPercent}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="progress-chart-legend">
          <LegendKey cls="bar-done" label="Done" />
          <LegendKey cls="bar-partial" label="Partial" />
          <LegendKey cls="bar-none-key" label="None" />
        </div>
      </section>
    </div>
  );
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: 'positive' | 'warning' | 'danger';
}) {
  const numeric = typeof value === 'number';
  return (
    <div className="progress-stat-row">
      <span className={`progress-stat-dot ${accent ? `dot-${accent}` : ''}`} aria-hidden="true" />
      <span className="progress-stat-label">{label}</span>
      <span className="progress-stat-value mono">
        {numeric ? <AnimatedNumber value={value as number} /> : value}
      </span>
    </div>
  );
}

function LegendKey({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="progress-legend-key">
      <span className={`progress-legend-dot ${cls}`} aria-hidden="true" />
      {label}
    </span>
  );
}

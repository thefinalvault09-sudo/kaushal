import { Link } from 'react-router-dom';

/** Shown on the Today screen when there are no scheduled commitments yet.
 *  Extracted from screens/Today.tsx verbatim. */
export default function TodayEmpty() {
  const steps = [
    { k: 'Plan', d: 'Define a commitment and a daily target.' },
    { k: 'Execute', d: 'Run the lens and do the work.' },
    { k: 'Record', d: 'Time is logged automatically, every day.' },
    { k: 'Repeat', d: 'Return tomorrow. Consistency compounds.' },
  ];
  return (
    <div className="today-empty">
      <div className="lens today-empty-panel">
        <div className="today-empty-head">
          <span className="eyebrow">Still water</span>
          <h2 className="today-empty-title display">
            The surface is <em className="accent">calm.</em>
          </h2>
          <p className="today-empty-copy">
            Grit moves on a single current. Set your first commitment and the day begins to
            fill with something you can measure.
          </p>
          <Link to="/new-commitment" className="btn btn-primary today-empty-cta">
            New commitment
          </Link>
        </div>
        <ol className="today-empty-loop">
          {steps.map((s, i) => (
            <li key={s.k} className="today-empty-step" style={{ ['--i' as string]: i }}>
              <span className="today-empty-step-drop" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <div className="today-empty-step-k serif">{s.k}</div>
                <div className="today-empty-step-d">{s.d}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

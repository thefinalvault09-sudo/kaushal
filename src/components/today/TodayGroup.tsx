import { useApp } from '../../context/AppContext';
import type { TodayItem } from '../../domain/habit';
import TodayCard, { type TodayCardControls } from './TodayCard';

/** A titled section of Today cards ("Needs attention" / "In progress" /
 *  "Complete"). Extracted from screens/Today.tsx verbatim. */
export default function TodayGroup({
  title,
  tone,
  items,
  controls,
  timer,
  collapsedMeta,
}: {
  title: string;
  tone: 'attention' | 'progress' | 'complete';
  items: TodayItem[];
  controls: TodayCardControls;
  timer: ReturnType<typeof useApp>['timer'];
  collapsedMeta?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="today-group">
      <div className={`today-group-head tone-${tone}`}>
        <h2 className="today-group-title label">{title}</h2>
        <span className="today-group-count">{items.length}</span>
        <span className="today-group-rule" aria-hidden="true" />
      </div>
      <div className="today-trail stagger">
        {items.map((item, idx) => (
          <TodayCard key={item.commitment.id} item={item} controls={controls} timer={timer} index={idx} compact={collapsedMeta} />
        ))}
      </div>
    </section>
  );
}

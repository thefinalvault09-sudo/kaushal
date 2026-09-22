/** Status-color legend beneath a commitment's history calendar.
 *  Extracted from screens/CommitmentDetail.tsx verbatim. */
export default function Legend() {
  const items: { cls: string; label: string }[] = [
    { cls: 'cal-neutral', label: 'Not started' },
    { cls: 'cal-warning', label: 'Partial' },
    { cls: 'cal-danger', label: 'Missed' },
    { cls: 'cal-success', label: 'Done' },
  ];
  return (
    <div className="commitment-calendar-legend">
      {items.map((item) => (
        <span key={item.label} className="commitment-calendar-legend-item">
          <span className={`commitment-calendar-legend-dot ${item.cls}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

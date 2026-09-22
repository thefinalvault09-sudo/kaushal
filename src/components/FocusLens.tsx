import './FocusLens.css';

type LensState = 'idle' | 'running' | 'paused' | 'done';

interface FocusLensProps {
  /** 0-100 fill level. */
  percent: number;
  size?: number;
  state?: LensState;
  /** 'drop' = teardrop (timer hero), 'round' = circular gauge (stats). */
  variant?: 'drop' | 'round';
  children?: React.ReactNode;
  className?: string;
}

/**
 * The Aqua Lens signature object: a translucent liquid lens that literally
 * fills with water as `percent` rises (a wavy meniscus crest included).
 * Purely presentational — used by the timer, Today context, and Progress.
 */
export default function FocusLens({
  percent,
  size = 220,
  state = 'idle',
  variant = 'round',
  children,
  className,
}: FocusLensProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  // The water body used to animate `height` (calc(P% + 8px)) to rise from
  // the bottom — a layout-triggering property that forces reflow+repaint
  // on every transition frame, including once a second for as long as a
  // timer session runs. Instead, the body is now a fixed-size box (always
  // full lens height + 8px bleed, laid out once) that's translated
  // vertically to reveal the same P%-based fill, clipped by the lens's own
  // `overflow: hidden`. Since the crests are children of this same box
  // (not independently scaled), they keep riding exactly at the water's
  // current top edge with their own shape/size untouched — same look,
  // compositor-only motion. `size` is the lens's own pixel size (passed
  // in), so this reveal math mirrors the old percentage-of-container height
  // exactly: translateY(px) = size * (1 - clamped/100).
  const waterTranslateY = size * (1 - clamped / 100);
  return (
    <div
      className={`focus-lens variant-${variant} state-${state} ${className ?? ''}`}
      style={{ width: size, height: size }}
      role="presentation"
    >
      <div className="focus-lens-water" style={{ transform: `translateY(${waterTranslateY}px)` }} aria-hidden="true">
        <span className="crest crest-a" />
        <span className="crest crest-b" />
      </div>
      <div className="focus-lens-sheen" aria-hidden="true" />
      <div className="focus-lens-content">{children}</div>
    </div>
  );
}

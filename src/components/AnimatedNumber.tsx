import { useCountUp } from '../hooks/useCountUp';

interface AnimatedNumberProps {
  value: number;
  /** Decimal places to render. Default 0. */
  decimals?: number;
  suffix?: string;
  prefix?: string;
  durationMs?: number;
  className?: string;
}

/**
 * Renders a number that animates toward its target value. Tabular figures keep
 * the width stable so surrounding layout never jitters while counting.
 */
export default function AnimatedNumber({
  value,
  decimals = 0,
  suffix = '',
  prefix = '',
  durationMs = 600,
  className,
}: AnimatedNumberProps) {
  // Passing `decimals` into the hook lets it skip per-frame setStates whose
  // rounded output wouldn't change — the exact metric this component
  // displays via `.toFixed(decimals)`. See useCountUp for details.
  const animated = useCountUp(value, durationMs, decimals);
  const display = animated.toFixed(decimals);
  return (
    <span className={`num ${className ?? ''}`}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

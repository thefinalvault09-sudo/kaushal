import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/**
 * Smoothly animates a number toward `target` using requestAnimationFrame.
 * Used for progress percentages and day counts so values "settle" into place
 * rather than snapping. Honors prefers-reduced-motion by jumping instantly.
 *
 * `decimals` mirrors what the caller will render with `.toFixed(decimals)`
 * (see AnimatedNumber). We skip any per-frame `setState` whose rounded
 * output would match the last one committed — the visible number wouldn't
 * change, but a re-render would still be triggered for every unchanged
 * frame (~40 of the 60fps frames during a 600ms tween on a 0→100% count).
 * On a Today screen with several AnimatedNumbers, that's dozens of wasted
 * React commits per interaction. The exact target is always committed at
 * animation end so there's no lingering rounding drift.
 */
export function useCountUp(target: number, durationMs = 600, decimals = 0): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number | null>(null);
  const lastEmittedRef = useRef<string>(target.toFixed(decimals));

  useEffect(() => {
    if (reduced) {
      setValue(target);
      fromRef.current = target;
      lastEmittedRef.current = target.toFixed(decimals);
      return;
    }

    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) return;

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + delta * eased;
      const rounded = current.toFixed(decimals);
      if (rounded !== lastEmittedRef.current) {
        lastEmittedRef.current = rounded;
        setValue(current);
      }
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
        // Always land exactly on target — guards against a final rounded
        // frame skipping the last setState and leaving a tiny drift.
        lastEmittedRef.current = target.toFixed(decimals);
        setValue(target);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      fromRef.current = target;
    };
  }, [target, durationMs, reduced, decimals]);

  return value;
}

import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * Wraps routed content and replays a subtle enter animation whenever the path
 * changes, so navigating between screens feels like one continuous instrument
 * rather than a hard page swap. Keying on pathname remounts the wrapper, which
 * restarts the CSS `route-enter` animation. Respect for reduced-motion is
 * handled globally in CSS.
 */
export default function RouteTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="route-enter">
      {children}
    </div>
  );
}

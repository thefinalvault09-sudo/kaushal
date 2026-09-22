import { useEffect, useState } from 'react';

/**
 * Tracks the user's `prefers-reduced-motion` setting. Motion-driven components
 * read this and fall back to an instant, static presentation when reduced
 * motion is requested. (The global CSS also neutralizes transitions, but JS
 * animations like count-ups need to opt out explicitly.)
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

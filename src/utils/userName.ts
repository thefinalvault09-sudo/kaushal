// A minimal, presentation-only helper for the first-launch onboarding
// screen. This name is NOT part of the application's business data model
// (it is not a Commitment / DayRecord / TimerState / Settings field) — it
// lives in localStorage purely so the onboarding screen can greet the user
// dynamically, without touching IndexedDB persistence, the repository
// layer, AppContext, or routes.

const STORAGE_KEY = 'grit_user_name';

/**
 * Capitalizes only the first letter of a name; the rest is lowercased.
 * Also trims surrounding whitespace.
 *
 *   "kaushal" -> "Kaushal"
 *   "KAUSHAL" -> "Kaushal"
 *   "kAuShAl" -> "Kaushal"
 */
export function capitalizeFirstLetter(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed[0].toUpperCase() + trimmed.slice(1).toLowerCase();
}

/** Reads the previously-saved display name, if any. Never throws. */
export function getStoredUserName(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Persists the display name. Failing silently is acceptable — this is a
 *  cosmetic greeting, not application data. */
export function storeUserName(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Storage may be unavailable (private browsing, quota) — ignore.
  }
}

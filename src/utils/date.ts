// Date helpers. Everything operates on local calendar days represented as
// 'YYYY-MM-DD' strings, so a "day" always means the user's local day and
// never shifts because of timezone/UTC math.

/**
 * Returns "today"'s date as a local 'YYYY-MM-DD' string.
 *
 * `resetHour` (0-23, default 0) is the user-configurable hour at which the
 * app's day rolls over (Settings > Daily refresh time). Before that hour,
 * the current moment still counts as the previous calendar day — e.g. with
 * resetHour=4, at 2:00am the "today" the app shows is still yesterday's
 * date. Implemented by shifting `now` back by `resetHour` hours before
 * reading its local calendar date, so every call site that already calls
 * `todayISO()` with no argument keeps its exact original behavior
 * (resetHour 0 = midnight = today's actual calendar date, unchanged).
 */
export function todayISO(resetHour = 0): string {
  const now = new Date();
  if (resetHour > 0) {
    now.setHours(now.getHours() - resetHour);
  }
  return toISODate(now);
}

/** Formats a Date as local 'YYYY-MM-DD' (no UTC conversion). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parses a 'YYYY-MM-DD' string into a local Date at midnight. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Adds `days` (can be negative) to a 'YYYY-MM-DD' string, returns new ISO string. */
export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Inclusive end date given a start date and a duration in days. */
export function computeEndDate(startDate: string, durationDays: number): string {
  return addDays(startDate, Math.max(1, durationDays) - 1);
}

/** Returns every 'YYYY-MM-DD' date from start to end, inclusive. */
export function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let cursor = startDate;
  // Guard against malformed ranges causing an infinite loop.
  let safety = 0;
  while (cursor <= endDate && safety < 100000) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
    safety++;
  }
  return dates;
}

/** True if `iso` is strictly before today (local), honoring the same
 *  configurable daily-reset hour as `todayISO()`. */
export function isPast(iso: string, resetHour = 0): boolean {
  return iso < todayISO(resetHour);
}

export function isToday(iso: string, resetHour = 0): boolean {
  return iso === todayISO(resetHour);
}

/** Formats seconds as H:MM:SS (or M:SS if under an hour) for compact display. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Formats seconds as "Xh Ym" for daily-target style display; drops 0 parts. */
export function formatHoursMinutes(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/** Human-friendly date, e.g. "Wed, 16 Sep 2026". */
export function formatLongDate(iso: string): string {
  const d = parseISODate(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Short date, e.g. "16 Sep". */
export function formatShortDate(iso: string): string {
  const d = parseISODate(iso);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

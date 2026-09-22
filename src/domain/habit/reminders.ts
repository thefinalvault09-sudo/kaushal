// Smart Reminders — pure decision logic. Given a habit + its day record +
// the current day boundary, decides WHETHER a reminder is warranted and, if
// so, WHAT it should say and which action it offers. No side effects, no I/O,
// no scheduling — that lives in utils/reminderScheduler.ts. This module only
// reads the same derived state the UI already uses (computeDisplayStatus,
// computeDurationProgress), so a reminder can never contradict what the
// Today screen shows.
//
// Entirely local and deterministic: no AI, no network, no personal data.

import type { Commitment, DayRecord } from '../../types';
import { resolveTrackingType } from './trackingType';
import { computeDisplayStatus } from './history';
import { computeDurationProgress } from './durationTracking';
import { formatHoursMinutes, formatShortDate, parseISODate } from '../../utils/date';

export type ReminderType = 'NOT_STARTED' | 'BEHIND' | 'DEADLINE';

export interface SmartReminder {
  commitmentId: string;
  commitmentName: string;
  type: ReminderType;
  /** Short headline, e.g. "Your commitment is waiting." */
  title: string;
  /** Actionable one-liner, e.g. "Study — 45 min remaining today." */
  body: string;
  /** The single action the reminder offers: Start / Continue / Complete. */
  actionLabel: 'Start' | 'Continue' | 'Complete';
}

/** A commitment whose overall end date is this many days away (or fewer) is
 *  treated as "deadline approaching". 1 = ends today or tomorrow. */
const DEADLINE_DAYS_AHEAD = 1;

const TITLES: Record<ReminderType, string> = {
  NOT_STARTED: 'Your commitment is waiting.',
  BEHIND: "You're still short today.",
  DEADLINE: 'Deadline approaching.',
};

/** Whole days from `fromISO` to `toISO` (local calendar days). */
function daysUntil(fromISO: string, toISO: string): number {
  const from = parseISODate(fromISO).getTime();
  const to = parseISODate(toISO).getTime();
  return Math.round((to - from) / 86_400_000);
}

/**
 * Computes the smart reminder for a single habit's day, or `null` when no
 * reminder should be sent.
 *
 * Returns null when:
 *   - the habit is currently being timed right now (`isTimedNow`) — no point
 *     nagging while the user is actively working on it;
 *   - today's target is already met (DONE / COMPLETED_LATE);
 *   - the day is already over and missed (MISSED), or otherwise not an
 *     actionable "today" state.
 *
 * `today` is the app's current logical day (honoring the user's daily-reset
 * hour) and `dailyResetHour` is passed through to status derivation so this
 * agrees with the rest of the app about what "today" and "over" mean.
 */
export function computeReminder(
  commitment: Commitment,
  record: DayRecord,
  today: string,
  dailyResetHour: number,
  isTimedNow: boolean,
): SmartReminder | null {
  // Only ever remind about the current logical day's record.
  if (record.date !== today) return null;
  if (isTimedNow) return null;

  // No live timer is passed: reminders reflect the persisted state, not a
  // running session (that case is handled by the isTimedNow guard above).
  const status = computeDisplayStatus(record, null, dailyResetHour);
  if (status === 'DONE' || status === 'COMPLETED_LATE' || status === 'MISSED') {
    return null;
  }

  const name = commitment.name;
  const daysLeft = daysUntil(today, commitment.endDate);
  // Only treat as a deadline while the end date is still today/ahead — a
  // past end date is not an actionable "approaching" deadline.
  const deadlineApproaching = daysLeft >= 0 && daysLeft <= DEADLINE_DAYS_AHEAD;

  const isCompletion = resolveTrackingType(commitment) === 'COMPLETION';

  if (isCompletion) {
    const type: ReminderType = deadlineApproaching ? 'DEADLINE' : 'NOT_STARTED';
    const body = deadlineApproaching
      ? `${name} — not done yet, ends ${formatShortDate(commitment.endDate)}.`
      : `${name} — not completed yet today.`;
    return { commitmentId: commitment.id, commitmentName: name, type, title: TITLES[type], body, actionLabel: 'Complete' };
  }

  // DURATION habit.
  const { remainingSeconds } = computeDurationProgress(record.elapsedSeconds, record.targetSeconds);
  const started = record.elapsedSeconds > 0;
  const baseType: ReminderType = started ? 'BEHIND' : 'NOT_STARTED';
  const type: ReminderType = deadlineApproaching ? 'DEADLINE' : baseType;
  const remaining = formatHoursMinutes(remainingSeconds);
  const body = deadlineApproaching
    ? `${name} — ${remaining} remaining, ends ${formatShortDate(commitment.endDate)}.`
    : `${name} — ${remaining} remaining today.`;
  return {
    commitmentId: commitment.id,
    commitmentName: name,
    type,
    title: TITLES[type],
    body,
    actionLabel: started ? 'Continue' : 'Start',
  };
}

/** Urgency order used when a single "most important" reminder is needed
 *  (e.g. a test reminder): deadline first, then behind, then not-started. */
const URGENCY: Record<ReminderType, number> = { DEADLINE: 0, BEHIND: 1, NOT_STARTED: 2 };

/** Picks the single most urgent reminder from a list, or null if empty. */
export function pickPrimaryReminder(reminders: SmartReminder[]): SmartReminder | null {
  if (reminders.length === 0) return null;
  return [...reminders].sort((a, b) => URGENCY[a.type] - URGENCY[b.type])[0];
}

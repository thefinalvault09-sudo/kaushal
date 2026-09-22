// Domain logic for a habit's tracking type (DURATION vs COMPLETION). Pure,
// framework-free, no I/O. Moved verbatim from domain/trackingType.ts into
// domain/habit/ as part of consolidating all habit business logic under one
// module.

import type { Commitment, TrackingType } from '../../types';
import { formatHoursMinutes } from '../../utils/date';

/** Commitments created before `trackingType` existed have no such field;
 *  always treat that as 'DURATION' so old data keeps working unchanged. */
export function resolveTrackingType(commitment: Commitment): TrackingType {
  return commitment.trackingType ?? 'DURATION';
}

/**
 * Short label describing how a commitment is tracked, used in list/detail
 * meta lines (e.g. "1h 30m / day" or "Completion"). Centralizes a ternary
 * that was previously duplicated across Commitments and CommitmentDetail.
 */
export function formatTrackingLabel(commitment: Commitment): string {
  return resolveTrackingType(commitment) === 'COMPLETION'
    ? 'Completion'
    : `${formatHoursMinutes(commitment.dailyTargetSeconds)} / day`;
}

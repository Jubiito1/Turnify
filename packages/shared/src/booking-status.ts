import type { BookingStatus } from './enums';

/**
 * Valid booking status transitions. RN-014, RN-015
 * Final states (COMPLETED, CANCELLED, NO_SHOW) have no outgoing transitions.
 */
export const BOOKING_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

export function isFinalStatus(status: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[status].length === 0;
}

/** Statuses that require the appointment to have already started. RN-026 */
export const REQUIRES_STARTED: readonly BookingStatus[] = ['COMPLETED', 'NO_SHOW'];

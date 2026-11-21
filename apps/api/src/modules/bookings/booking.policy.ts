import type { BookingStatus } from '@prisma/client';
import { REQUIRES_STARTED, canTransition, isActiveStatus } from '@turnify/shared';
import { unprocessable } from '../../lib/errors';

const HOUR_MS = 60 * 60 * 1000;

/** RN-014 / RN-015: only transitions listed in BOOKING_TRANSITIONS are allowed. */
export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw unprocessable('INVALID_TRANSITION', `No se puede pasar una reserva de ${from} a ${to}`, {
      from,
      to,
    });
  }
}

/** RN-026: COMPLETED / NO_SHOW only once the appointment has started. */
export function assertStartedIfRequired(to: BookingStatus, startsAt: Date, now = new Date()): void {
  if (REQUIRES_STARTED.includes(to) && startsAt.getTime() > now.getTime()) {
    throw unprocessable(
      'BOOKING_NOT_STARTED',
      'Solo se puede completar o marcar ausencia en turnos que ya comenzaron',
    );
  }
}

/** Only active bookings (PENDING / CONFIRMED) can be rescheduled. */
export function assertReschedulable(status: BookingStatus): void {
  if (!isActiveStatus(status)) {
    throw unprocessable('BOOKING_NOT_ACTIVE', 'Solo se pueden reprogramar reservas activas');
  }
}

/** RN-013: clients must cancel/reschedule at least `minHours` before the start. */
export function assertClientNotice(startsAt: Date, minHours: number, now = new Date()): void {
  if (startsAt.getTime() - now.getTime() < minHours * HOUR_MS) {
    throw unprocessable(
      'CANCELLATION_WINDOW_PASSED',
      `Los cambios deben hacerse con al menos ${minHours} h de anticipación`,
      { cancellationMinHours: minHours },
    );
  }
}

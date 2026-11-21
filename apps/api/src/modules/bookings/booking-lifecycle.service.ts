import type { Booking, BookingStatus, Prisma } from '@prisma/client';
import type { rescheduleBookingSchema, updateBookingStatusSchema } from '@turnify/shared';
import type { z } from 'zod';
import { AppError, conflict, notFound, permissionDenied } from '../../lib/errors';
import { lockProfessional } from '../../lib/locks';
import { prisma } from '../../lib/prisma';
import { assertEligibleProfessional } from '../availability/availability.service';
import { bookingInclude, toBookingDTO } from './booking.mapper';
import {
  assertClientNotice,
  assertReschedulable,
  assertStartedIfRequired,
  assertTransition,
} from './booking.policy';
import {
  assertSlotIsBookable,
  assertWithinBookingWindow,
  translateOverlapError,
} from './booking.service';

/** Who performs a lifecycle action; determines scope and permissions. */
export type BookingActor =
  | { kind: 'client'; userId: string }
  | { kind: 'admin'; userId: string; businessId: string }
  | { kind: 'professional'; userId: string; professionalId: string; canCompleteBookings: boolean };

/** RN-009, RN-010, RN-011, RN-021: resources outside the actor's scope look non-existent. */
function scopeWhere(actor: BookingActor): Prisma.BookingWhereInput {
  switch (actor.kind) {
    case 'client':
      return { clientId: actor.userId };
    case 'admin':
      return { businessId: actor.businessId };
    case 'professional':
      return { professionalId: actor.professionalId };
  }
}

async function findScopedBooking(actor: BookingActor, bookingId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, ...scopeWhere(actor) },
    include: { business: true, service: true },
  });
  if (!booking) throw notFound('Reserva no encontrada');
  return booking;
}

/**
 * Applies a status change with optimistic concurrency: the update only succeeds if the status
 * is still the one validated, so two concurrent transitions cannot both win.
 */
async function applyStatus(
  booking: Booking,
  to: BookingStatus,
  actor: BookingActor,
  reason?: string,
) {
  const data: Prisma.BookingUncheckedUpdateManyInput =
    to === 'CANCELLED'
      ? {
          status: to,
          cancelledAt: new Date(),
          cancelledById: actor.userId,
          cancellationReason: reason ?? null,
        }
      : { status: to };

  const { count } = await prisma.booking.updateMany({
    where: { id: booking.id, status: booking.status },
    data,
  });
  if (count === 0) {
    throw conflict(
      'BOOKING_CHANGED',
      'La reserva fue modificada por otra persona. Recarga e intenta de nuevo.',
    );
  }
  const updated = await prisma.booking.findUniqueOrThrow({
    where: { id: booking.id },
    include: bookingInclude,
  });
  return toBookingDTO(updated);
}

/** Client cancellation: own bookings only, respecting the business minimum notice (RN-013). */
export async function cancelAsClient(userId: string, bookingId: string, reason?: string) {
  const actor: BookingActor = { kind: 'client', userId };
  const booking = await findScopedBooking(actor, bookingId);
  assertTransition(booking.status, 'CANCELLED');
  assertClientNotice(booking.startsAt, booking.business.cancellationMinHours);
  return applyStatus(booking, 'CANCELLED', actor, reason);
}

/** Admin and professional status changes (RN-014, RN-015, RN-026, RN-033). */
export async function updateStatus(
  actor: Exclude<BookingActor, { kind: 'client' }>,
  bookingId: string,
  input: z.output<typeof updateBookingStatusSchema>,
) {
  const booking = await findScopedBooking(actor, bookingId);
  if (actor.kind === 'professional') {
    if (input.status !== 'COMPLETED' && input.status !== 'NO_SHOW') {
      throw permissionDenied('Los profesionales solo pueden completar turnos o marcar ausencias');
    }
    if (!actor.canCompleteBookings) {
      throw permissionDenied('No tienes permiso para completar turnos');
    }
  }
  assertTransition(booking.status, input.status);
  assertStartedIfRequired(input.status, booking.startsAt);
  return applyStatus(booking, input.status, actor, input.reason);
}

/**
 * RN-016: rescheduling re-validates the new slot exactly like a new booking (window, working
 * hours, blocks, overlaps). The booking keeps its id and never collides with itself because the
 * EXCLUDE constraint compares against other rows only.
 */
export async function reschedule(
  actor: Exclude<BookingActor, { kind: 'professional' }>,
  bookingId: string,
  input: z.output<typeof rescheduleBookingSchema>,
) {
  const booking = await findScopedBooking(actor, bookingId);
  assertReschedulable(booking.status);

  const newProfessionalId =
    actor.kind === 'admin' && input.professionalId ? input.professionalId : booking.professionalId;
  if (actor.kind === 'client') {
    assertClientNotice(booking.startsAt, booking.business.cancellationMinHours); // RN-013
  }
  if (newProfessionalId !== booking.professionalId) {
    await assertEligibleProfessional(booking.businessId, booking.serviceId, newProfessionalId);
  }

  const startsAt = new Date(input.startsAt);
  assertWithinBookingWindow(booking.business, startsAt);
  const endsAt = new Date(startsAt.getTime() + booking.service.durationMinutes * 60_000);
  // A client reschedule needs re-confirmation unless the business auto-confirms.
  const status: BookingStatus =
    actor.kind === 'client' && !booking.business.autoConfirm ? 'PENDING' : booking.status;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Lock both agendas in a stable order to avoid deadlocks when changing professional.
      for (const id of [...new Set([booking.professionalId, newProfessionalId])].sort()) {
        await lockProfessional(tx, id);
      }
      await assertSlotIsBookable(tx, {
        business: booking.business,
        service: booking.service,
        professionalId: newProfessionalId,
        startsAt,
      });
      const { count } = await tx.booking.updateMany({
        where: { id: booking.id, status: booking.status },
        data: { startsAt, endsAt, professionalId: newProfessionalId, status },
      });
      if (count === 0) {
        throw conflict(
          'BOOKING_CHANGED',
          'La reserva fue modificada por otra persona. Recarga e intenta de nuevo.',
        );
      }
      return tx.booking.findUniqueOrThrow({ where: { id: booking.id }, include: bookingInclude });
    });
    return toBookingDTO(updated);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw translateOverlapError(error);
  }
}

import type { Business, BookingStatus, Prisma, Service } from '@prisma/client';
import type { adminCreateBookingSchema, createBookingSchema } from '@turnify/shared';
import type { z } from 'zod';
import { isConstraintViolation, isExclusionViolation } from '../../lib/db-errors';
import { AppError, conflict, notFound, unprocessable } from '../../lib/errors';
import { lockProfessional } from '../../lib/locks';
import { prisma } from '../../lib/prisma';
import { localDateOf, professionalSlots } from '../availability/availability.engine';
import {
  assertEligibleProfessional,
  getBookableService,
  loadSchedules,
} from '../availability/availability.service';
import { bookingInclude, toBookingDTO } from './booking.mapper';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Translates database exclusion violations into business errors (RN-006, RN-020, RN-028). */
export function translateOverlapError(error: unknown): unknown {
  if (isConstraintViolation(error, 'booking_client_no_overlap')) {
    return conflict('CLIENT_OVERLAP', 'Ya tienes otra reserva activa en ese horario');
  }
  if (isConstraintViolation(error, 'booking_no_overlap') || isExclusionViolation(error)) {
    return conflict('SLOT_TAKEN', 'Ese horario acaba de ser reservado. Elige otro, por favor.');
  }
  return error;
}

/** RN-001 / RN-027: specific errors for past starts and starts beyond the booking horizon. */
export function assertWithinBookingWindow(business: Business, startsAt: Date, now = new Date()) {
  if (startsAt.getTime() <= now.getTime()) {
    throw unprocessable('BOOKING_IN_PAST', 'No se puede reservar un horario pasado');
  }
  if (startsAt.getTime() > now.getTime() + business.bookingHorizonDays * DAY_MS) {
    throw unprocessable(
      'BEYOND_BOOKING_HORIZON',
      `Solo se puede reservar con hasta ${business.bookingHorizonDays} días de anticipación`,
    );
  }
}

/**
 * RN-004, RN-005, RN-034: the start must be one of the professional's generated slots
 * (inside working hours, aligned, not blocked). Runs under the agenda lock. Overlaps with other
 * bookings are left to the EXCLUDE constraint, the single source of truth (RN-020).
 */
export async function assertSlotIsBookable(
  tx: Prisma.TransactionClient,
  params: { business: Business; service: Service; professionalId: string; startsAt: Date },
) {
  const { business, service, professionalId, startsAt } = params;
  const date = localDateOf(startsAt, business.timezone);
  const window = {
    from: new Date(startsAt.getTime() - DAY_MS),
    to: new Date(startsAt.getTime() + 2 * DAY_MS),
  };
  const [schedule] = await loadSchedules({
    db: tx,
    businessId: business.id,
    serviceId: service.id,
    professionalIds: [professionalId],
    ...window,
    includeBookings: false,
  });

  const fits =
    schedule &&
    professionalSlots(schedule, {
      date,
      timezone: business.timezone,
      durationMinutes: service.durationMinutes,
      slotIntervalMinutes: business.slotIntervalMinutes,
      bookingHorizonDays: business.bookingHorizonDays,
      now: new Date(),
    }).some((slot) => slot.start.toMillis() === startsAt.getTime());

  if (!fits) {
    throw conflict(
      'SLOT_UNAVAILABLE',
      'El horario elegido no está disponible para ese profesional',
    );
  }
}

interface CreateParams {
  business: Business;
  input: z.output<typeof createBookingSchema>;
  clientId: string;
  status: BookingStatus;
}

async function createValidatedBooking({ business, input, clientId, status }: CreateParams) {
  const service = await getBookableService(business.id, input.serviceId); // RN-002, RN-017, RN-025
  await assertEligibleProfessional(business.id, service.id, input.professionalId); // RN-003
  const startsAt = new Date(input.startsAt);
  assertWithinBookingWindow(business, startsAt); // RN-001, RN-027
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000); // RN-007

  try {
    // RN-020: validation and insert happen atomically under the professional lock,
    // and the EXCLUDE constraint rejects any overlap that slips through.
    const booking = await prisma.$transaction(async (tx) => {
      await lockProfessional(tx, input.professionalId);
      await assertSlotIsBookable(tx, {
        business,
        service,
        professionalId: input.professionalId,
        startsAt,
      });
      return tx.booking.create({
        data: {
          businessId: business.id,
          serviceId: service.id,
          professionalId: input.professionalId,
          clientId,
          startsAt,
          endsAt,
          status,
          priceCents: service.priceCents, // RN-018: price snapshot
          notes: input.notes ?? null,
        },
        include: bookingInclude,
      });
    });
    return toBookingDTO(booking);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw translateOverlapError(error);
  }
}

async function businessOfService(serviceId: string): Promise<Business> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { business: true },
  });
  if (!service || !service.business.isActive) throw notFound('Servicio no encontrado');
  return service.business;
}

/** Client self-service booking. Status depends on the business auto-confirm setting. */
export async function createClientBooking(
  clientId: string,
  input: z.output<typeof createBookingSchema>,
) {
  const business = await businessOfService(input.serviceId);
  return createValidatedBooking({
    business,
    input,
    clientId,
    status: business.autoConfirm ? 'CONFIRMED' : 'PENDING',
  });
}

/** Admin booking on behalf of a client (existing account or new guest client). RN-011 */
export async function createAdminBooking(
  businessId: string,
  input: z.output<typeof adminCreateBookingSchema>,
) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });

  let client = await prisma.user.findUnique({ where: { email: input.client.email } });
  if (client && client.role !== 'CLIENT') {
    throw unprocessable('INVALID_CLIENT', 'El email pertenece a una cuenta que no es de cliente');
  }
  client ??= await prisma.user.create({
    data: { email: input.client.email, name: input.client.name, role: 'CLIENT' },
  });

  return createValidatedBooking({ business, input, clientId: client.id, status: 'CONFIRMED' });
}

/** RN-009 / RN-021: a client only sees its own bookings; others look non-existent. */
export async function getClientBooking(clientId: string, bookingId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, clientId },
    include: bookingInclude,
  });
  if (!booking) throw notFound('Reserva no encontrada');
  return toBookingDTO(booking);
}

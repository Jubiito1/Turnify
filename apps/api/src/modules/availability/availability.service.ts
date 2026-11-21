import type { Business, Prisma, Service } from '@prisma/client';
import { ACTIVE_BOOKING_STATUSES } from '@turnify/shared';
import type {
  AvailabilityQuery,
  AvailabilityResponse,
  AvailabilitySummaryQuery,
  AvailabilitySummaryResponse,
} from '@turnify/shared';
import { DateTime } from 'luxon';
import { notFound, unprocessable } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { findActiveBusinessBySlug } from '../catalog/catalog.service';
import { computeAvailableSlots, dayWindow, type ProfessionalSchedule } from './availability.engine';

interface LoadSchedulesParams {
  businessId: string;
  serviceId: string;
  professionalIds?: string[];
  from: Date;
  to: Date;
  /** Bookings are excluded when validating a new booking: the DB constraint is the authority (RN-020). */
  includeBookings: boolean;
  /** Ignore this booking (rescheduling must not collide with itself, RN-016). */
  excludeBookingId?: string;
  /** Transaction client, so reads happen under the agenda lock when validating writes. */
  db?: Prisma.TransactionClient;
}

/** Loads eligible professionals (RN-003) with their hours and busy intervals in a time window. */
export async function loadSchedules(params: LoadSchedulesParams): Promise<ProfessionalSchedule[]> {
  const db = params.db ?? prisma;
  const professionals = await db.professional.findMany({
    where: {
      businessId: params.businessId,
      isActive: true,
      services: { some: { serviceId: params.serviceId } },
      ...(params.professionalIds ? { id: { in: params.professionalIds } } : {}),
    },
    orderBy: { displayName: 'asc' },
    include: {
      workingHours: true,
      blocks: {
        where: { startsAt: { lt: params.to }, endsAt: { gt: params.from } },
        select: { startsAt: true, endsAt: true },
      },
      bookings: params.includeBookings
        ? {
            where: {
              // RN-012: only active bookings occupy time.
              status: { in: [...ACTIVE_BOOKING_STATUSES] },
              startsAt: { lt: params.to },
              endsAt: { gt: params.from },
              ...(params.excludeBookingId ? { id: { not: params.excludeBookingId } } : {}),
            },
            select: { startsAt: true, endsAt: true },
          }
        : false,
    },
  });

  return professionals.map((p) => ({
    id: p.id,
    workingHours: p.workingHours,
    busy: [
      ...p.blocks.map((b) => ({ start: b.startsAt, end: b.endsAt })),
      ...(p.bookings ?? []).map((b) => ({ start: b.startsAt, end: b.endsAt })),
    ],
  }));
}

/** Validates that the service is bookable in the business (RN-002, RN-017, RN-025). */
export async function getBookableService(businessId: string, serviceId: string): Promise<Service> {
  const service = await prisma.service.findFirst({ where: { id: serviceId, businessId } });
  if (!service) throw notFound('Servicio no encontrado');
  if (!service.isActive) {
    throw unprocessable('SERVICE_INACTIVE', 'El servicio no está disponible para nuevas reservas');
  }
  return service;
}

/** RN-003: the professional must be active and enabled for the service. */
export async function assertEligibleProfessional(
  businessId: string,
  serviceId: string,
  professionalId: string,
): Promise<void> {
  const eligible = await prisma.professional.count({
    where: {
      id: professionalId,
      businessId,
      isActive: true,
      services: { some: { serviceId } },
    },
  });
  if (!eligible) {
    throw unprocessable(
      'PROFESSIONAL_NOT_ELIGIBLE',
      'El profesional seleccionado no realiza este servicio',
    );
  }
}

function engineSettings(business: Business, service: Service) {
  return {
    timezone: business.timezone,
    durationMinutes: service.durationMinutes,
    slotIntervalMinutes: business.slotIntervalMinutes,
    bookingHorizonDays: business.bookingHorizonDays,
  };
}

/** RN-008: real availability for one local date. */
export async function getAvailability(
  slug: string,
  query: AvailabilityQuery,
): Promise<AvailabilityResponse> {
  const business = await findActiveBusinessBySlug(slug);
  const service = await getBookableService(business.id, query.serviceId);
  if (query.professionalId) {
    await assertEligibleProfessional(business.id, service.id, query.professionalId);
  }

  const window = dayWindow(query.date, business.timezone);
  const professionals = await loadSchedules({
    businessId: business.id,
    serviceId: service.id,
    professionalIds: query.professionalId ? [query.professionalId] : undefined,
    ...window,
    includeBookings: true,
  });

  return {
    date: query.date,
    timezone: business.timezone,
    serviceId: service.id,
    durationMinutes: service.durationMinutes,
    slots: computeAvailableSlots({
      ...engineSettings(business, service),
      date: query.date,
      now: new Date(),
      professionals,
    }),
  };
}

/** Number of free slots per day for a date range (powers the calendar day picker). */
export async function getAvailabilitySummary(
  slug: string,
  query: AvailabilitySummaryQuery,
): Promise<AvailabilitySummaryResponse> {
  const business = await findActiveBusinessBySlug(slug);
  const service = await getBookableService(business.id, query.serviceId);
  if (query.professionalId) {
    await assertEligibleProfessional(business.id, service.id, query.professionalId);
  }

  const firstDay = DateTime.fromISO(query.from, { zone: business.timezone });
  const dates = Array.from({ length: query.days }, (_, i) =>
    firstDay.plus({ days: i }).toISODate()!,
  );
  const professionals = await loadSchedules({
    businessId: business.id,
    serviceId: service.id,
    professionalIds: query.professionalId ? [query.professionalId] : undefined,
    from: dayWindow(dates[0]!, business.timezone).from,
    to: dayWindow(dates[dates.length - 1]!, business.timezone).to,
    includeBookings: true,
  });

  const now = new Date();
  return {
    timezone: business.timezone,
    serviceId: service.id,
    days: dates.map((date) => ({
      date,
      slotCount: computeAvailableSlots({
        ...engineSettings(business, service),
        date,
        now,
        professionals,
      }).length,
    })),
  };
}

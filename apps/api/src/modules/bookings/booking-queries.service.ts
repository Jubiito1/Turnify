import type { Prisma } from '@prisma/client';
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_STATUS_LABELS,
  centsToAmountString,
} from '@turnify/shared';
import type {
  BookingListQuery,
  ClientBookingListQuery,
  ClientSummaryDTO,
  DateRangeQuery,
  Paginated,
  BookingDTO,
} from '@turnify/shared';
import { DateTime } from 'luxon';
import { toCsv } from '../../lib/csv';
import { notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { bookingInclude, toBookingDTO } from './booking.mapper';

const MAX_RANGE_ITEMS = 2000;
const MAX_EXPORT_ROWS = 5000;

/** Converts local YYYY-MM-DD bounds (business time zone) into a startsAt filter. */
function localRange(
  timezone: string,
  from?: string,
  to?: string,
): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: DateTime.fromISO(from, { zone: timezone }).startOf('day').toJSDate() } : {}),
    ...(to
      ? { lt: DateTime.fromISO(to, { zone: timezone }).plus({ days: 1 }).startOf('day').toJSDate() }
      : {}),
  };
}

async function timezoneOf(businessId: string): Promise<string> {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { timezone: true },
  });
  return business.timezone;
}

/** RN-009: a client's own bookings, split into upcoming (active, future) and past/history. */
export async function listClientBookings(
  clientId: string,
  query: ClientBookingListQuery,
): Promise<Paginated<BookingDTO>> {
  const now = new Date();
  const where: Prisma.BookingWhereInput =
    query.scope === 'upcoming'
      ? { clientId, startsAt: { gte: now }, status: { in: [...ACTIVE_BOOKING_STATUSES] } }
      : {
          clientId,
          OR: [{ startsAt: { lt: now } }, { status: { notIn: [...ACTIVE_BOOKING_STATUSES] } }],
        };

  const [total, items] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: { startsAt: query.scope === 'upcoming' ? 'asc' : 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: bookingInclude,
    }),
  ]);
  return { total, page: query.page, pageSize: query.pageSize, items: items.map(toBookingDTO) };
}

/** RN-011 / RN-025: filters always start from the admin's business. */
type AdminFilters = Partial<Omit<BookingListQuery, 'page' | 'pageSize'>>;

function adminWhere(businessId: string, timezone: string, query: AdminFilters) {
  const where: Prisma.BookingWhereInput = {
    businessId,
    ...(query.status ? { status: { in: query.status } } : {}),
    ...(query.professionalId ? { professionalId: query.professionalId } : {}),
    ...(query.serviceId ? { serviceId: query.serviceId } : {}),
    ...(query.q
      ? {
          client: {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
            ],
          },
        }
      : {}),
  };
  const range = localRange(timezone, query.from, query.to);
  if (range) where.startsAt = range;
  return where;
}

export async function listAdminBookings(
  businessId: string,
  query: BookingListQuery,
): Promise<Paginated<BookingDTO>> {
  const where = adminWhere(businessId, await timezoneOf(businessId), query);
  const [total, items] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: { startsAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: bookingInclude,
    }),
  ]);
  return { total, page: query.page, pageSize: query.pageSize, items: items.map(toBookingDTO) };
}

/** All bookings in a date range for calendar views (week/month), sorted chronologically. */
export async function listCalendar(businessId: string, query: DateRangeQuery) {
  const timezone = await timezoneOf(businessId);
  const items = await prisma.booking.findMany({
    where: adminWhere(businessId, timezone, query),
    orderBy: { startsAt: 'asc' },
    take: MAX_RANGE_ITEMS,
    include: bookingInclude,
  });
  return items.map(toBookingDTO);
}

export async function getAdminBooking(businessId: string, bookingId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, businessId },
    include: bookingInclude,
  });
  if (!booking) throw notFound('Reserva no encontrada');
  return toBookingDTO(booking);
}

/** CSV export with the same filters as the admin list, times in the business time zone. */
export async function exportBookingsCsv(businessId: string, query: AdminFilters): Promise<string> {
  const timezone = await timezoneOf(businessId);
  const bookings = await prisma.booking.findMany({
    where: adminWhere(businessId, timezone, query),
    orderBy: { startsAt: 'asc' },
    take: MAX_EXPORT_ROWS,
    include: bookingInclude,
  });

  return toCsv(
    [
      'Fecha',
      'Inicio',
      'Fin',
      'Servicio',
      'Profesional',
      'Cliente',
      'Email',
      'Teléfono',
      'Estado',
      'Precio',
      'Notas',
    ],
    bookings.map((b) => {
      const start = DateTime.fromJSDate(b.startsAt, { zone: timezone });
      const end = DateTime.fromJSDate(b.endsAt, { zone: timezone });
      return [
        start.toISODate(),
        start.toFormat('HH:mm'),
        end.toFormat('HH:mm'),
        b.service.name,
        b.professional.displayName,
        b.client.name,
        b.client.email,
        b.client.phone,
        BOOKING_STATUS_LABELS[b.status],
        centsToAmountString(b.priceCents),
        b.notes,
      ];
    }),
  );
}

/** RN-010: a professional's own agenda in a date range. */
export async function listProfessionalBookings(professionalId: string, query: BookingListQuery) {
  const professional = await prisma.professional.findUniqueOrThrow({
    where: { id: professionalId },
    select: { business: { select: { timezone: true } } },
  });
  const where: Prisma.BookingWhereInput = {
    professionalId,
    ...(query.status ? { status: { in: query.status } } : {}),
  };
  const range = localRange(professional.business.timezone, query.from, query.to);
  if (range) where.startsAt = range;

  const [total, items] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: { startsAt: range ? 'asc' : 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: bookingInclude,
    }),
  ]);
  return { total, page: query.page, pageSize: query.pageSize, items: items.map(toBookingDTO) };
}

/** Clients that have booked at least once with the business (RN-025), with per-business totals. */
export async function listClients(
  businessId: string,
  query: { q?: string; page: number; pageSize: number },
): Promise<Paginated<ClientSummaryDTO>> {
  const where: Prisma.UserWhereInput = {
    bookings: { some: { businessId } },
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
            { phone: { contains: query.q } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: { id: true, name: true, email: true, phone: true },
    }),
  ]);

  const ids = users.map((u) => u.id);
  const [totals, completed] = await Promise.all([
    prisma.booking.groupBy({
      by: ['clientId'],
      where: { businessId, clientId: { in: ids } },
      _count: { _all: true },
      _max: { startsAt: true },
    }),
    prisma.booking.groupBy({
      by: ['clientId'],
      where: { businessId, clientId: { in: ids }, status: 'COMPLETED' },
      _count: { _all: true },
    }),
  ]);
  const totalBy = new Map(totals.map((t) => [t.clientId, t]));
  const completedBy = new Map(completed.map((c) => [c.clientId, c._count._all]));

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    items: users.map((u) => ({
      ...u,
      totalBookings: totalBy.get(u.id)?._count._all ?? 0,
      completedBookings: completedBy.get(u.id) ?? 0,
      lastBookingAt: totalBy.get(u.id)?._max.startsAt?.toISOString() ?? null,
    })),
  };
}

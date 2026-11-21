import { isActiveStatus, sumCents } from '@turnify/shared';
import type { StatsDTO, StatsQuery } from '@turnify/shared';
import { DateTime } from 'luxon';
import { unprocessable } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

const MAX_RANGE_DAYS = 366;

const ratio = (part: number, total: number) =>
  total === 0 ? 0 : Math.round((part / total) * 10_000) / 10_000;

/**
 * RN-022: every metric is computed from persisted bookings in the requested local date range
 * (default: the last 30 days). Money is summed as integer cents (RN-018).
 */
export async function getStats(businessId: string, query: StatsQuery): Promise<StatsDTO> {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  const tz = business.timezone;
  const today = DateTime.now().setZone(tz).startOf('day');
  const fromDay = query.from
    ? DateTime.fromISO(query.from, { zone: tz })
    : today.minus({ days: 29 });
  const toDay = query.to ? DateTime.fromISO(query.to, { zone: tz }) : today;
  const days = Math.round(toDay.diff(fromDay, 'days').days) + 1;
  if (days < 1 || days > MAX_RANGE_DAYS) {
    throw unprocessable('INVALID_RANGE', `El rango debe tener entre 1 y ${MAX_RANGE_DAYS} días`);
  }

  const [bookings, services, professionals] = await Promise.all([
    prisma.booking.findMany({
      where: {
        businessId,
        startsAt: {
          gte: fromDay.startOf('day').toJSDate(),
          lt: toDay.plus({ days: 1 }).startOf('day').toJSDate(),
        },
      },
      select: {
        status: true,
        startsAt: true,
        endsAt: true,
        priceCents: true,
        clientId: true,
        serviceId: true,
        professionalId: true,
      },
    }),
    prisma.service.findMany({ where: { businessId }, select: { id: true, name: true } }),
    prisma.professional.findMany({
      where: { businessId },
      select: { id: true, displayName: true, isActive: true, workingHours: true },
    }),
  ]);

  const minutesOf = (b: { startsAt: Date; endsAt: Date }) =>
    Math.round((b.endsAt.getTime() - b.startsAt.getTime()) / 60_000);
  const completed = bookings.filter((b) => b.status === 'COMPLETED');
  const cancelled = bookings.filter((b) => b.status === 'CANCELLED');
  const occupying = bookings.filter((b) => b.status !== 'CANCELLED');

  // Working minutes offered per professional in the range (active professionals only).
  const dates = Array.from({ length: days }, (_, i) => fromDay.plus({ days: i }));
  const availableMinutesOf = (
    hours: { weekday: number; startMinute: number; endMinute: number }[],
  ) =>
    dates.reduce(
      (sum, d) =>
        sum +
        hours
          .filter((h) => h.weekday === d.weekday % 7)
          .reduce((acc, h) => acc + (h.endMinute - h.startMinute), 0),
      0,
    );

  const byProfessional = professionals
    .map((p) => {
      const own = bookings.filter((b) => b.professionalId === p.id);
      return {
        professionalId: p.id,
        name: p.displayName,
        bookings: own.filter((b) => b.status !== 'CANCELLED').length,
        completed: own.filter((b) => b.status === 'COMPLETED').length,
        revenueCents: sumCents(
          own.filter((b) => b.status === 'COMPLETED').map((b) => b.priceCents),
        ),
        bookedMinutes: own
          .filter((b) => b.status !== 'CANCELLED')
          .reduce((s, b) => s + minutesOf(b), 0),
        availableMinutes: p.isActive ? availableMinutesOf(p.workingHours) : 0,
      };
    })
    .filter((p) => p.bookings > 0 || p.availableMinutes > 0)
    .sort((a, b) => b.revenueCents - a.revenueCents || b.bookings - a.bookings);

  const byService = services
    .map((s) => {
      const own = bookings.filter((b) => b.serviceId === s.id);
      return {
        serviceId: s.id,
        name: s.name,
        bookings: own.filter((b) => b.status !== 'CANCELLED').length,
        completed: own.filter((b) => b.status === 'COMPLETED').length,
        revenueCents: sumCents(
          own.filter((b) => b.status === 'COMPLETED').map((b) => b.priceCents),
        ),
      };
    })
    .filter((s) => s.bookings > 0)
    .sort((a, b) => b.bookings - a.bookings || b.revenueCents - a.revenueCents);

  const byDay = dates.map((d) => {
    const date = d.toISODate()!;
    const own = occupying.filter(
      (b) => DateTime.fromJSDate(b.startsAt, { zone: tz }).toISODate() === date,
    );
    return {
      date,
      bookings: own.length,
      revenueCents: sumCents(own.filter((b) => b.status === 'COMPLETED').map((b) => b.priceCents)),
    };
  });

  const bookedMinutes = byProfessional.reduce((s, p) => s + p.bookedMinutes, 0);
  const availableMinutes = byProfessional.reduce((s, p) => s + p.availableMinutes, 0);

  return {
    range: { from: fromDay.toISODate()!, to: toDay.toISODate()! },
    totals: {
      bookings: bookings.length,
      active: bookings.filter((b) => isActiveStatus(b.status)).length,
      completed: completed.length,
      cancelled: cancelled.length,
      noShow: bookings.filter((b) => b.status === 'NO_SHOW').length,
      revenueCents: sumCents(completed.map((b) => b.priceCents)),
      expectedRevenueCents: sumCents(
        bookings.filter((b) => isActiveStatus(b.status)).map((b) => b.priceCents),
      ),
      uniqueClients: new Set(occupying.map((b) => b.clientId)).size,
      cancellationRate: ratio(cancelled.length, bookings.length),
      occupancyRate: ratio(bookedMinutes, availableMinutes),
    },
    byService,
    byProfessional,
    byDay,
  };
}

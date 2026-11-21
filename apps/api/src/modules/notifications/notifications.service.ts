import type { NotificationType } from '@prisma/client';
import type { BookingDTO, NotificationDTO } from '@turnify/shared';
import { DateTime } from 'luxon';
import { notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';

export type BookingEvent = 'created' | 'confirmed' | 'cancelled' | 'rescheduled' | 'completed';
export type ActorKind = 'client' | 'admin' | 'professional';

const TYPE_BY_EVENT: Record<BookingEvent, NotificationType> = {
  created: 'BOOKING_CREATED',
  confirmed: 'BOOKING_CONFIRMED',
  cancelled: 'BOOKING_CANCELLED',
  rescheduled: 'BOOKING_RESCHEDULED',
  completed: 'BOOKING_COMPLETED',
};

const TITLE_FOR_CLIENT: Record<BookingEvent, string> = {
  created: 'Reserva registrada',
  confirmed: 'Reserva confirmada',
  cancelled: 'Reserva cancelada',
  rescheduled: 'Reserva reprogramada',
  completed: '¡Gracias por tu visita!',
};

const TITLE_FOR_BUSINESS: Record<BookingEvent, string> = {
  created: 'Nueva reserva',
  confirmed: 'Reserva confirmada',
  cancelled: 'Reserva cancelada',
  rescheduled: 'Reserva reprogramada',
  completed: 'Turno completado',
};

function describe(booking: BookingDTO): string {
  const when = DateTime.fromISO(booking.startsAt, { zone: booking.business.timezone })
    .setLocale('es')
    .toFormat("ccc d/LL 'a las' HH:mm");
  return `${booking.service.name} · ${when} · ${booking.business.name}`;
}

/**
 * In-app notifications for booking events. Best-effort: a failure here is logged and never
 * breaks the booking operation that already succeeded.
 */
export async function notifyBookingEvent(
  event: BookingEvent,
  booking: BookingDTO,
  actor: ActorKind,
): Promise<void> {
  try {
    const [business, professional] = await Promise.all([
      prisma.business.findUnique({ where: { id: booking.business.id }, select: { ownerId: true } }),
      prisma.professional.findUnique({
        where: { id: booking.professional.id },
        select: { userId: true },
      }),
    ]);
    const body = describe(booking);
    const rows: { userId: string; title: string; body: string }[] = [];

    // The client hears about changes made by others (and gets a receipt for its own booking).
    if (actor !== 'client' || event === 'created') {
      rows.push({ userId: booking.client.id, title: TITLE_FOR_CLIENT[event], body });
    }
    // The business (owner and assigned professional) hears about changes made by others.
    const staffBody = `${booking.client.name} · ${body}`;
    if (actor !== 'admin' && business) {
      rows.push({ userId: business.ownerId, title: TITLE_FOR_BUSINESS[event], body: staffBody });
    }
    if (actor !== 'professional' && professional?.userId && event !== 'completed') {
      rows.push({ userId: professional.userId, title: TITLE_FOR_BUSINESS[event], body: staffBody });
    }

    if (rows.length) {
      await prisma.notification.createMany({
        data: rows.map((r) => ({ ...r, type: TYPE_BY_EVENT[event], bookingId: booking.id })),
      });
    }
  } catch (error) {
    logger.error({ err: error, bookingId: booking.id, event }, 'Failed to create notifications');
  }
}

export async function listNotifications(userId: string, unreadOnly: boolean) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return {
    unreadCount,
    items: items.map((n): NotificationDTO => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      bookingId: n.bookingId,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export async function markRead(userId: string, notificationId: string) {
  const { count } = await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (
    count === 0 &&
    !(await prisma.notification.count({ where: { id: notificationId, userId } }))
  ) {
    throw notFound('Notificación no encontrada');
  }
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

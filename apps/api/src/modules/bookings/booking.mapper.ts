import type { Booking } from '@prisma/client';
import type { BookingDTO } from '@turnify/shared';

export const bookingInclude = {
  service: { select: { id: true, name: true, durationMinutes: true } },
  professional: { select: { id: true, displayName: true } },
  business: {
    select: { id: true, name: true, slug: true, timezone: true, cancellationMinHours: true },
  },
  client: { select: { id: true, name: true, email: true, phone: true } },
};

type BookingWithRelations = Booking & {
  service: BookingDTO['service'];
  professional: BookingDTO['professional'];
  business: BookingDTO['business'];
  client: BookingDTO['client'];
};

export function toBookingDTO(b: BookingWithRelations): BookingDTO {
  return {
    id: b.id,
    status: b.status,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    priceCents: b.priceCents,
    notes: b.notes,
    cancellationReason: b.cancellationReason,
    cancelledAt: b.cancelledAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
    service: b.service,
    professional: b.professional,
    business: b.business,
    client: b.client,
  };
}

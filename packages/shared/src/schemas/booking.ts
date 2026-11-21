import { z } from 'zod';
import { BOOKING_STATUSES } from '../enums';
import { emailSchema, personNameSchema } from './auth';
import {
  dateOnlySchema,
  idSchema,
  isoDateTimeSchema,
  optionalText,
  paginationSchema,
} from './common';

/** RN-007: the client only sends the start; the server computes the end from the service. */
export const createBookingSchema = z.object({
  serviceId: idSchema,
  professionalId: idSchema,
  startsAt: isoDateTimeSchema,
  notes: optionalText(500),
});
export type CreateBookingInput = z.input<typeof createBookingSchema>;

export const adminCreateBookingSchema = createBookingSchema.extend({
  client: z.object({
    name: personNameSchema,
    email: emailSchema,
  }),
});
export type AdminCreateBookingInput = z.input<typeof adminCreateBookingSchema>;

export const rescheduleBookingSchema = z.object({
  startsAt: isoDateTimeSchema,
  professionalId: idSchema.optional(),
});
export type RescheduleBookingInput = z.input<typeof rescheduleBookingSchema>;

export const cancelBookingSchema = z.object({
  reason: optionalText(300),
});
export type CancelBookingInput = z.input<typeof cancelBookingSchema>;

export const updateBookingStatusSchema = z.object({
  status: z.enum(BOOKING_STATUSES),
  reason: optionalText(300),
});
export type UpdateBookingStatusInput = z.input<typeof updateBookingStatusSchema>;

const statusListSchema = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (!value) return undefined;
    const parts = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const valid = parts.filter((s): s is (typeof BOOKING_STATUSES)[number] =>
      (BOOKING_STATUSES as readonly string[]).includes(s),
    );
    if (valid.length !== parts.length) {
      ctx.addIssue({ code: 'custom', message: 'Estado inválido' });
      return z.NEVER;
    }
    return valid;
  });

export const bookingListQuerySchema = paginationSchema.extend({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  status: statusListSchema,
  professionalId: idSchema.optional(),
  serviceId: idSchema.optional(),
  q: z.string().trim().max(80).optional(),
});
export type BookingListQuery = z.infer<typeof bookingListQuerySchema>;

export const clientBookingListQuerySchema = paginationSchema.extend({
  scope: z.enum(['upcoming', 'past']).default('upcoming'),
});
export type ClientBookingListQuery = z.infer<typeof clientBookingListQuerySchema>;

export const availabilityQuerySchema = z.object({
  serviceId: idSchema,
  date: dateOnlySchema,
  professionalId: idSchema.optional(),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const timeBlockCreateSchema = z
  .object({
    professionalId: idSchema,
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema,
    reason: optionalText(200),
  })
  .refine((b) => new Date(b.startsAt).getTime() < new Date(b.endsAt).getTime(), {
    message: 'El inicio debe ser anterior al fin',
    path: ['endsAt'],
  })
  .refine(
    (b) =>
      new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime() <= 90 * 24 * 60 * 60 * 1000,
    { message: 'Un bloqueo puede durar como máximo 90 días', path: ['endsAt'] },
  );
export type TimeBlockCreateInput = z.input<typeof timeBlockCreateSchema>;

export const dateRangeQuerySchema = z.object({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  professionalId: idSchema.optional(),
});
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;

export const availabilitySummaryQuerySchema = z.object({
  serviceId: idSchema,
  from: dateOnlySchema,
  days: z.coerce.number().int().min(1).max(31).default(14),
  professionalId: idSchema.optional(),
});
export type AvailabilitySummaryQuery = z.infer<typeof availabilitySummaryQuerySchema>;

export const clientListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(80).optional(),
});
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;

export const statsQuerySchema = z.object({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});
export type StatsQuery = z.infer<typeof statsQuerySchema>;

export const notificationListQuerySchema = z.object({
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

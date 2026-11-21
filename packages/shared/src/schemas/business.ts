import { z } from 'zod';
import { BUSINESS_CATEGORIES } from '../enums';
import { optionalText, paginationSchema, phoneSchema, timeZoneSchema } from './common';

export const SLOT_INTERVAL_OPTIONS = [5, 10, 15, 20, 30, 60] as const;

export const businessSettingsSchema = z.object({
  name: z.string().trim().min(2, 'Ingresa al menos 2 caracteres').max(80),
  description: optionalText(600),
  category: z.enum(BUSINESS_CATEGORIES, { message: 'Selecciona un rubro' }),
  timezone: timeZoneSchema,
  address: optionalText(160),
  phone: phoneSchema,
  /** RN-013 */
  cancellationMinHours: z.coerce
    .number()
    .int('Debe ser un número entero')
    .min(0, 'Mínimo 0 horas')
    .max(168, 'Máximo 168 horas (7 días)'),
  /** RN-034 */
  slotIntervalMinutes: z.coerce
    .number()
    .int()
    .refine((v) => (SLOT_INTERVAL_OPTIONS as readonly number[]).includes(v), {
      message: 'Intervalo no permitido',
    }),
  /** RN-027 */
  bookingHorizonDays: z.coerce
    .number()
    .int('Debe ser un número entero')
    .min(1, 'Mínimo 1 día')
    .max(365, 'Máximo 365 días'),
  autoConfirm: z.boolean(),
});
export type BusinessSettingsInput = z.input<typeof businessSettingsSchema>;

export const businessListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(80).optional(),
  category: z.enum(BUSINESS_CATEGORIES).optional(),
});
export type BusinessListQuery = z.infer<typeof businessListQuerySchema>;

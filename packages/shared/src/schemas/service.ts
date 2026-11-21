import { z } from 'zod';
import { optionalText } from './common';

export const serviceCreateSchema = z.object({
  name: z.string().trim().min(2, 'Ingresa al menos 2 caracteres').max(80, 'Máximo 80 caracteres'),
  description: optionalText(500),
  /** RN-007: appointment duration is defined by the service. */
  durationMinutes: z.coerce
    .number()
    .int('Debe ser un número entero')
    .min(5, 'Mínimo 5 minutos')
    .max(480, 'Máximo 8 horas')
    .refine((v) => v % 5 === 0, { message: 'Debe ser múltiplo de 5 minutos' }),
  /** RN-018: integer cents, never floating point. */
  priceCents: z.coerce
    .number()
    .int('El precio debe expresarse en centavos enteros')
    .min(0, 'El precio no puede ser negativo')
    .max(100_000_000, 'Precio demasiado alto'),
  isActive: z.boolean().default(true),
});
export type ServiceCreateInput = z.input<typeof serviceCreateSchema>;

export const serviceUpdateSchema = serviceCreateSchema.partial();
export type ServiceUpdateInput = z.input<typeof serviceUpdateSchema>;

import { z } from 'zod';
import { isValidTimeZone } from '../time';

export const idSchema = z.uuid({ message: 'Identificador inválido' });

export const isoDateTimeSchema = z.iso.datetime({
  offset: true,
  message: 'Fecha y hora inválidas (se espera ISO-8601)',
});

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (se espera AAAA-MM-DD)');

export const timeZoneSchema = z
  .string()
  .min(1)
  .refine(isValidTimeZone, { message: 'Zona horaria inválida' });

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

export const phoneSchema = z
  .string()
  .trim()
  .max(30, 'Máximo 30 caracteres')
  .regex(/^[+\d\s()-]*$/, 'Teléfono inválido')
  .optional()
  .transform((value) => (value === '' ? undefined : value));

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

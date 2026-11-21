import { z } from 'zod';
import { BUSINESS_CATEGORIES } from '../enums';
import { optionalText, phoneSchema, timeZoneSchema } from './common';

/** RN-031 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Email inválido' }).max(120, 'Máximo 120 caracteres'));

/** RN-031: 8–72 chars (bcrypt limit), at least one letter and one number. */
export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña debe tener como máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra')
  .regex(/\d/, 'La contraseña debe incluir al menos un número');

export const personNameSchema = z
  .string()
  .trim()
  .min(2, 'Ingresa al menos 2 caracteres')
  .max(80, 'Máximo 80 caracteres');

export const registerSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingresa tu contraseña').max(200),
});
export type LoginInput = z.input<typeof loginSchema>;

export const registerBusinessSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
  businessName: z.string().trim().min(2, 'Ingresa al menos 2 caracteres').max(80),
  category: z.enum(BUSINESS_CATEGORIES, { message: 'Selecciona un rubro' }),
  timezone: timeZoneSchema,
  address: optionalText(160),
  phone: phoneSchema,
});
export type RegisterBusinessInput = z.input<typeof registerBusinessSchema>;

export const updateProfileSchema = z.object({
  name: personNameSchema,
  phone: phoneSchema,
});
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Ingresa tu contraseña actual').max(200),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'La nueva contraseña debe ser distinta de la actual',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

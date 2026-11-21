import { z } from 'zod';
import { MINUTES_PER_DAY, intervalsOverlap } from '../time';
import { emailSchema, passwordSchema } from './auth';
import { idSchema, optionalText } from './common';

export const professionalCreateSchema = z.object({
  displayName: z.string().trim().min(2, 'Ingresa al menos 2 caracteres').max(80),
  bio: optionalText(400),
  isActive: z.boolean().default(true),
  /** RN-033 */
  canManageBlocks: z.boolean().default(false),
  canCompleteBookings: z.boolean().default(true),
  /** Optional login account for the professional panel. */
  account: z
    .object({
      email: emailSchema,
      password: passwordSchema,
    })
    .optional(),
});
export type ProfessionalCreateInput = z.input<typeof professionalCreateSchema>;

export const professionalUpdateSchema = professionalCreateSchema.omit({ account: true }).partial();
export type ProfessionalUpdateInput = z.input<typeof professionalUpdateSchema>;

export const assignServicesSchema = z.object({
  serviceIds: z
    .array(idSchema)
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'Hay servicios repetidos',
    }),
});
export type AssignServicesInput = z.input<typeof assignServicesSchema>;

export const workingHourSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(MINUTES_PER_DAY),
    endMinute: z.number().int().min(0).max(MINUTES_PER_DAY),
  })
  .refine((h) => h.startMinute < h.endMinute, {
    message: 'La hora de inicio debe ser anterior a la de fin',
    path: ['endMinute'],
  });
export type WorkingHourInput = z.input<typeof workingHourSchema>;

/** RN-030: valid ranges and no overlapping ranges on the same weekday. */
export const workingHoursSchema = z
  .object({
    hours: z.array(workingHourSchema).max(50),
  })
  .superRefine((data, ctx) => {
    data.hours.forEach((a, i) => {
      data.hours.forEach((b, j) => {
        if (
          j > i &&
          a.weekday === b.weekday &&
          intervalsOverlap(a.startMinute, a.endMinute, b.startMinute, b.endMinute)
        ) {
          ctx.addIssue({
            code: 'custom',
            message: 'Hay franjas horarias superpuestas en el mismo día',
            path: ['hours', j],
          });
        }
      });
    });
  });
export type WorkingHoursInput = z.input<typeof workingHoursSchema>;

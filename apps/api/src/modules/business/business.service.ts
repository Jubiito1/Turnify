import type { businessSettingsSchema, registerBusinessSchema } from '@turnify/shared';
import type { z } from 'zod';
import { conflict, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { slugify } from '../../lib/slug';
import { getSessionUser, hashPassword } from '../auth/auth.service';
import { toBusinessDetail } from './business.mapper';

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || 'negocio';
  for (let attempt = 1; attempt <= 50; attempt++) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    const taken = await prisma.business.count({ where: { slug: candidate } });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Onboarding: creates the admin account and its business atomically. */
export async function registerBusiness(input: z.output<typeof registerBusinessSchema>) {
  if (await prisma.user.count({ where: { email: input.email } })) {
    throw conflict('EMAIL_TAKEN', 'Ya existe una cuenta con ese email');
  }
  const passwordHash = await hashPassword(input.password);
  const slug = await uniqueSlug(input.businessName);

  const business = await prisma.$transaction(async (tx) => {
    const owner = await tx.user.create({
      data: { name: input.name, email: input.email, passwordHash, role: 'ADMIN' },
    });
    return tx.business.create({
      data: {
        ownerId: owner.id,
        name: input.businessName,
        slug,
        category: input.category,
        timezone: input.timezone,
        address: input.address,
        phone: input.phone,
      },
    });
  });

  return { user: await getSessionUser(business.ownerId), business: toBusinessDetail(business) };
}

/** RN-011: always scoped by the businessId taken from the admin session. */
export async function getBusiness(businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw notFound('Negocio no encontrado');
  return toBusinessDetail(business);
}

export async function updateBusiness(
  businessId: string,
  input: z.output<typeof businessSettingsSchema>,
) {
  const business = await prisma.business.update({
    where: { id: businessId },
    data: {
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      timezone: input.timezone,
      address: input.address ?? null,
      phone: input.phone ?? null,
      cancellationMinHours: input.cancellationMinHours,
      slotIntervalMinutes: input.slotIntervalMinutes,
      bookingHorizonDays: input.bookingHorizonDays,
      autoConfirm: input.autoConfirm,
    },
  });
  return toBusinessDetail(business);
}

import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';

/** Test data builders writing real rows to the ephemeral database. */

export const TEST_PASSWORD = 'secret123';
let passwordHashCache: string | undefined;

async function passwordHash() {
  passwordHashCache ??= await bcrypt.hash(TEST_PASSWORD, 4);
  return passwordHashCache;
}

const unique = () => randomUUID().slice(0, 8);

export async function createUser(overrides: { role?: Role; email?: string; name?: string } = {}) {
  return prisma.user.create({
    data: {
      email: overrides.email ?? `user-${unique()}@test.dev`,
      name: overrides.name ?? 'Test User',
      role: overrides.role ?? 'CLIENT',
      passwordHash: await passwordHash(),
    },
  });
}

export async function createBusiness(
  overrides: Partial<{
    name: string;
    timezone: string;
    cancellationMinHours: number;
    slotIntervalMinutes: number;
    bookingHorizonDays: number;
    autoConfirm: boolean;
  }> = {},
) {
  const owner = await createUser({ role: 'ADMIN' });
  const business = await prisma.business.create({
    data: {
      ownerId: owner.id,
      name: overrides.name ?? 'Test Business',
      slug: `test-${unique()}`,
      category: 'BEAUTY',
      timezone: overrides.timezone ?? 'America/Argentina/Buenos_Aires',
      cancellationMinHours: overrides.cancellationMinHours ?? 24,
      slotIntervalMinutes: overrides.slotIntervalMinutes ?? 15,
      bookingHorizonDays: overrides.bookingHorizonDays ?? 60,
      autoConfirm: overrides.autoConfirm ?? false,
    },
  });
  return { business, owner };
}

export async function createService(
  businessId: string,
  overrides: Partial<{
    name: string;
    durationMinutes: number;
    priceCents: number;
    isActive: boolean;
  }> = {},
) {
  return prisma.service.create({
    data: {
      businessId,
      name: overrides.name ?? 'Haircut',
      durationMinutes: overrides.durationMinutes ?? 30,
      priceCents: overrides.priceCents ?? 150000,
      isActive: overrides.isActive ?? true,
    },
  });
}

/** Creates a professional working Monday–Saturday 09:00–18:00 (local business time) for the given services. */
export async function createProfessional(
  businessId: string,
  serviceIds: string[],
  overrides: Partial<{
    displayName: string;
    isActive: boolean;
    withAccount: boolean;
    canManageBlocks: boolean;
    canCompleteBookings: boolean;
    hours: { weekday: number; startMinute: number; endMinute: number }[];
  }> = {},
) {
  const user = overrides.withAccount ? await createUser({ role: 'PROFESSIONAL' }) : null;
  const hours =
    overrides.hours ??
    [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 540, endMinute: 1080 }));
  const professional = await prisma.professional.create({
    data: {
      businessId,
      displayName: overrides.displayName ?? 'Pro',
      isActive: overrides.isActive ?? true,
      canManageBlocks: overrides.canManageBlocks ?? false,
      canCompleteBookings: overrides.canCompleteBookings ?? true,
      userId: user?.id,
      services: { create: serviceIds.map((serviceId) => ({ serviceId })) },
      workingHours: { create: hours },
    },
  });
  return { professional, user };
}

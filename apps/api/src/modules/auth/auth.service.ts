import bcrypt from 'bcryptjs';
import type {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  SessionUser,
  updateProfileSchema,
} from '@turnify/shared';
import type { z } from 'zod';
import { isTest } from '../../config/env';
import { AppError, conflict, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

export const BCRYPT_ROUNDS = isTest ? 4 : 10;

/** Used to keep login timing similar whether or not the email exists. */
const DUMMY_HASH = bcrypt.hashSync('turnify-timing-guard-1', BCRYPT_ROUNDS);

const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos');

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function getSessionUser(userId: string): Promise<SessionUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { ownedBusiness: { select: { id: true } }, professional: { select: { id: true } } },
  });
  if (!user) throw notFound('Usuario no encontrado');
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    businessId: user.ownedBusiness?.id ?? null,
    professionalId: user.professional?.id ?? null,
  };
}

export async function emailExists(email: string): Promise<boolean> {
  return (await prisma.user.count({ where: { email } })) > 0;
}

/** RN-031: unique email, bcrypt hash only. */
export async function registerClient(input: z.output<typeof registerSchema>) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing?.passwordHash) throw conflict('EMAIL_TAKEN', 'Ya existe una cuenta con ese email');

  const passwordHash = await hashPassword(input.password);
  // A guest client created by a business (no password) can claim the account by registering.
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name: input.name, phone: input.phone, passwordHash },
      })
    : await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          passwordHash,
          role: 'CLIENT',
        },
      });
  return getSessionUser(user.id);
}

export async function login(input: z.output<typeof loginSchema>) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user?.passwordHash || !valid) throw invalidCredentials();
  return getSessionUser(user.id);
}

export async function updateProfile(userId: string, input: z.output<typeof updateProfileSchema>) {
  await prisma.user.update({
    where: { id: userId },
    data: { name: input.name, phone: input.phone ?? null },
  });
  return getSessionUser(userId);
}

export async function changePassword(userId: string, input: z.output<typeof changePasswordSchema>) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'La contraseña actual no es correcta');
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });
}

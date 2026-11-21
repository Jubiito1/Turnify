import type {
  assignServicesSchema,
  professionalCreateSchema,
  professionalUpdateSchema,
  workingHoursSchema,
} from '@turnify/shared';
import type { z } from 'zod';
import { conflict, notFound, unprocessable } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { hashPassword } from '../auth/auth.service';
import { professionalInclude, toProfessionalDTO } from './professional.mapper';

/** RN-011 / RN-021: lookups always include the admin's businessId. */
async function findOwnedProfessional(businessId: string, professionalId: string) {
  const professional = await prisma.professional.findFirst({
    where: { id: professionalId, businessId },
    include: professionalInclude,
  });
  if (!professional) throw notFound('Profesional no encontrado');
  return professional;
}

export async function listProfessionals(businessId: string) {
  const professionals = await prisma.professional.findMany({
    where: { businessId },
    orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }],
    include: professionalInclude,
  });
  return professionals.map(toProfessionalDTO);
}

export async function getProfessional(businessId: string, professionalId: string) {
  return toProfessionalDTO(await findOwnedProfessional(businessId, professionalId));
}

export async function createProfessional(
  businessId: string,
  input: z.output<typeof professionalCreateSchema>,
) {
  const account = input.account;
  if (account && (await prisma.user.count({ where: { email: account.email } }))) {
    throw conflict('EMAIL_TAKEN', 'Ya existe una cuenta con ese email');
  }
  const passwordHash = account ? await hashPassword(account.password) : null;

  const professional = await prisma.$transaction(async (tx) => {
    const user =
      account && passwordHash
        ? await tx.user.create({
            data: {
              email: account.email,
              name: input.displayName,
              passwordHash,
              role: 'PROFESSIONAL',
            },
          })
        : null;
    return tx.professional.create({
      data: {
        businessId,
        userId: user?.id,
        displayName: input.displayName,
        bio: input.bio ?? null,
        isActive: input.isActive,
        canManageBlocks: input.canManageBlocks,
        canCompleteBookings: input.canCompleteBookings,
      },
      include: professionalInclude,
    });
  });
  return toProfessionalDTO(professional);
}

/** RN-023: professionals are deactivated (isActive=false), never deleted, so history is kept. */
export async function updateProfessional(
  businessId: string,
  professionalId: string,
  input: z.output<typeof professionalUpdateSchema>,
) {
  await findOwnedProfessional(businessId, professionalId);
  const professional = await prisma.professional.update({
    where: { id: professionalId },
    data: {
      ...(input.displayName !== undefined && { displayName: input.displayName }),
      ...('bio' in input && { bio: input.bio ?? null }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.canManageBlocks !== undefined && { canManageBlocks: input.canManageBlocks }),
      ...(input.canCompleteBookings !== undefined && {
        canCompleteBookings: input.canCompleteBookings,
      }),
    },
    include: professionalInclude,
  });
  return toProfessionalDTO(professional);
}

/** RN-003 / RN-025: replaces the services a professional can perform; all must belong to the business. */
export async function assignServices(
  businessId: string,
  professionalId: string,
  input: z.output<typeof assignServicesSchema>,
) {
  await findOwnedProfessional(businessId, professionalId);
  const owned = await prisma.service.count({
    where: { id: { in: input.serviceIds }, businessId },
  });
  if (owned !== input.serviceIds.length) {
    throw unprocessable(
      'INVALID_SERVICE_ASSIGNMENT',
      'Alguno de los servicios no existe o no pertenece al negocio',
    );
  }
  await prisma.$transaction([
    prisma.professionalService.deleteMany({ where: { professionalId } }),
    prisma.professionalService.createMany({
      data: input.serviceIds.map((serviceId) => ({ professionalId, serviceId })),
    }),
  ]);
  return getProfessional(businessId, professionalId);
}

/** RN-030: replaces the weekly schedule atomically (validated by schema and DB constraints). */
export async function setWorkingHours(
  businessId: string,
  professionalId: string,
  input: z.output<typeof workingHoursSchema>,
) {
  await findOwnedProfessional(businessId, professionalId);
  await prisma.$transaction([
    prisma.workingHours.deleteMany({ where: { professionalId } }),
    prisma.workingHours.createMany({
      data: input.hours.map((h) => ({ ...h, professionalId })),
    }),
  ]);
  return getProfessional(businessId, professionalId);
}

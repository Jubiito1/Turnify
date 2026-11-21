import type { serviceCreateSchema, serviceUpdateSchema } from '@turnify/shared';
import type { z } from 'zod';
import { conflict, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { toServiceDTO } from './service.mapper';

/** RN-011 / RN-021: every lookup is scoped by the admin's business. */
async function findOwnedService(businessId: string, serviceId: string) {
  const service = await prisma.service.findFirst({ where: { id: serviceId, businessId } });
  if (!service) throw notFound('Servicio no encontrado');
  return service;
}

export async function listServices(businessId: string) {
  const services = await prisma.service.findMany({
    where: { businessId },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { professionals: true } } },
  });
  return services.map((s) => ({ ...toServiceDTO(s), professionalCount: s._count.professionals }));
}

export async function createService(
  businessId: string,
  input: z.output<typeof serviceCreateSchema>,
) {
  const service = await prisma.service.create({
    data: {
      businessId,
      name: input.name,
      description: input.description ?? null,
      durationMinutes: input.durationMinutes,
      priceCents: input.priceCents,
      isActive: input.isActive,
    },
  });
  return toServiceDTO(service);
}

/** RN-017: deactivating keeps history but blocks new bookings; price changes never alter past bookings (RN-018). */
export async function updateService(
  businessId: string,
  serviceId: string,
  input: z.output<typeof serviceUpdateSchema>,
) {
  await findOwnedService(businessId, serviceId);
  const service = await prisma.service.update({
    where: { id: serviceId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...('description' in input && { description: input.description ?? null }),
      ...(input.durationMinutes !== undefined && { durationMinutes: input.durationMinutes }),
      ...(input.priceCents !== undefined && { priceCents: input.priceCents }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });
  return toServiceDTO(service);
}

/** Services with booking history can only be deactivated, never deleted. */
export async function deleteService(businessId: string, serviceId: string) {
  await findOwnedService(businessId, serviceId);
  const bookings = await prisma.booking.count({ where: { serviceId } });
  if (bookings > 0) {
    throw conflict(
      'SERVICE_HAS_BOOKINGS',
      'El servicio tiene reservas registradas. Desactívalo en lugar de eliminarlo.',
    );
  }
  await prisma.service.delete({ where: { id: serviceId } });
}

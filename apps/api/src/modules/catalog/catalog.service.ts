import type { Prisma } from '@prisma/client';
import type {
  BusinessListQuery,
  BusinessSummary,
  Paginated,
  ProfessionalPublicDTO,
  ServiceDTO,
} from '@turnify/shared';
import { notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { toBusinessDetail } from '../business/business.mapper';

export async function listBusinesses(
  query: BusinessListQuery,
): Promise<Paginated<BusinessSummary>> {
  const where: Prisma.BusinessWhereInput = {
    isActive: true,
    ...(query.category ? { category: query.category } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { description: { contains: query.q, mode: 'insensitive' } },
            { address: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, businesses] = await Promise.all([
    prisma.business.count({ where }),
    prisma.business.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        services: { where: { isActive: true }, select: { priceCents: true } },
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    items: businesses.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      category: b.category,
      description: b.description,
      address: b.address,
      timezone: b.timezone,
      serviceCount: b.services.length,
      minPriceCents: b.services.length ? Math.min(...b.services.map((s) => s.priceCents)) : null,
    })),
  };
}

export async function findActiveBusinessBySlug(slug: string) {
  const business = await prisma.business.findFirst({ where: { slug, isActive: true } });
  if (!business) throw notFound('Negocio no encontrado');
  return business;
}

/** Public business page: only active services and active professionals (RN-017, RN-023). */
export async function getBusinessPage(slug: string) {
  const business = await findActiveBusinessBySlug(slug);
  const [services, professionals] = await Promise.all([
    prisma.service.findMany({
      where: { businessId: business.id, isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.professional.findMany({
      where: { businessId: business.id, isActive: true },
      orderBy: { displayName: 'asc' },
      include: {
        services: { where: { service: { isActive: true } }, select: { serviceId: true } },
      },
    }),
  ]);

  return {
    business: toBusinessDetail(business),
    services: services.map((s): ServiceDTO => ({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMinutes: s.durationMinutes,
      priceCents: s.priceCents,
      isActive: s.isActive,
    })),
    professionals: professionals.map((p): ProfessionalPublicDTO => ({
      id: p.id,
      displayName: p.displayName,
      bio: p.bio,
      serviceIds: p.services.map((s) => s.serviceId),
    })),
  };
}

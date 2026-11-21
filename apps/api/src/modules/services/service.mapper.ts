import type { Service } from '@prisma/client';
import type { ServiceDTO } from '@turnify/shared';

export function toServiceDTO(service: Service): ServiceDTO {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    durationMinutes: service.durationMinutes,
    priceCents: service.priceCents,
    isActive: service.isActive,
  };
}

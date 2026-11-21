import type { Professional, ProfessionalService, User, WorkingHours } from '@prisma/client';
import type { ProfessionalDTO } from '@turnify/shared';

export const professionalInclude = {
  user: { select: { email: true } },
  services: { select: { serviceId: true } },
  workingHours: { orderBy: [{ weekday: 'asc' as const }, { startMinute: 'asc' as const }] },
};

type ProfessionalWithRelations = Professional & {
  user: Pick<User, 'email'> | null;
  services: Pick<ProfessionalService, 'serviceId'>[];
  workingHours: WorkingHours[];
};

export function toProfessionalDTO(p: ProfessionalWithRelations): ProfessionalDTO {
  return {
    id: p.id,
    displayName: p.displayName,
    bio: p.bio,
    isActive: p.isActive,
    canManageBlocks: p.canManageBlocks,
    canCompleteBookings: p.canCompleteBookings,
    account: p.user ? { email: p.user.email } : null,
    serviceIds: p.services.map((s) => s.serviceId),
    workingHours: p.workingHours.map((h) => ({
      weekday: h.weekday,
      startMinute: h.startMinute,
      endMinute: h.endMinute,
    })),
  };
}

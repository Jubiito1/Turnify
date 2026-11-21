import { Router } from 'express';
import type { ProfessionalProfileDTO } from '@turnify/shared';
import { prisma } from '../../lib/prisma';
import { getProfessionalContext } from '../../middleware/auth';

/** Professional's own profile, mounted under /api/pro/me. */
export const proProfileRouter = Router();

proProfileRouter.get('/', async (req, res) => {
  const { id } = getProfessionalContext(req);
  const p = await prisma.professional.findUniqueOrThrow({
    where: { id },
    include: {
      business: { select: { id: true, name: true, slug: true, timezone: true } },
      workingHours: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] },
    },
  });
  const profile: ProfessionalProfileDTO = {
    id: p.id,
    displayName: p.displayName,
    bio: p.bio,
    canManageBlocks: p.canManageBlocks,
    canCompleteBookings: p.canCompleteBookings,
    business: p.business,
    workingHours: p.workingHours.map(({ weekday, startMinute, endMinute }) => ({
      weekday,
      startMinute,
      endMinute,
    })),
  };
  res.json({ professional: profile });
});

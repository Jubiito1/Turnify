import type { Prisma, TimeBlock } from '@prisma/client';
import { ACTIVE_BOOKING_STATUSES } from '@turnify/shared';
import type { DateRangeQuery, TimeBlockDTO, timeBlockCreateSchema } from '@turnify/shared';
import { DateTime } from 'luxon';
import type { z } from 'zod';
import { conflict, notFound, unprocessable } from '../../lib/errors';
import { lockProfessional } from '../../lib/locks';
import { prisma } from '../../lib/prisma';

type BlockWithProfessional = TimeBlock & { professional: { displayName: string } };

function toTimeBlockDTO(block: BlockWithProfessional): TimeBlockDTO {
  return {
    id: block.id,
    professionalId: block.professionalId,
    professionalName: block.professional.displayName,
    startsAt: block.startsAt.toISOString(),
    endsAt: block.endsAt.toISOString(),
    reason: block.reason,
  };
}

/** Scope of who is acting: an admin (whole business) or a professional (only itself). */
export type BlockScope =
  | { kind: 'admin'; businessId: string }
  | { kind: 'professional'; businessId: string; professionalId: string };

function scopeWhere(scope: BlockScope): Prisma.TimeBlockWhereInput {
  return scope.kind === 'admin'
    ? { professional: { businessId: scope.businessId } }
    : { professionalId: scope.professionalId };
}

export async function listBlocks(scope: BlockScope, query: DateRangeQuery, timezone: string) {
  const from = query.from
    ? DateTime.fromISO(query.from, { zone: timezone }).startOf('day').toJSDate()
    : new Date();
  const to = query.to
    ? DateTime.fromISO(query.to, { zone: timezone }).endOf('day').toJSDate()
    : undefined;

  const blocks = await prisma.timeBlock.findMany({
    where: {
      ...scopeWhere(scope),
      ...(query.professionalId ? { professionalId: query.professionalId } : {}),
      endsAt: { gt: from },
      ...(to ? { startsAt: { lt: to } } : {}),
    },
    orderBy: { startsAt: 'asc' },
    include: { professional: { select: { displayName: true } } },
  });
  return blocks.map(toTimeBlockDTO);
}

/** RN-005 / RN-029: a block cannot overlap active bookings; agenda writes are serialized per professional. */
export async function createBlock(
  scope: BlockScope,
  input: z.output<typeof timeBlockCreateSchema>,
  createdById: string,
) {
  const professional = await prisma.professional.findFirst({
    where: {
      id: input.professionalId,
      businessId: scope.businessId,
      ...(scope.kind === 'professional' ? { id: scope.professionalId } : {}),
    },
  });
  if (!professional) throw notFound('Profesional no encontrado');

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (endsAt <= new Date()) {
    throw unprocessable('BLOCK_IN_PAST', 'El bloqueo debe terminar en el futuro');
  }

  const block = await prisma.$transaction(async (tx) => {
    await lockProfessional(tx, professional.id);
    const conflicting = await tx.booking.count({
      where: {
        professionalId: professional.id,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (conflicting > 0) {
      throw conflict(
        'BLOCK_CONFLICTS_WITH_BOOKINGS',
        `El bloqueo se superpone con ${conflicting} reserva(s) activa(s). Cancélalas o reprográmalas primero.`,
        { conflictingBookings: conflicting },
      );
    }
    return tx.timeBlock.create({
      data: {
        professionalId: professional.id,
        startsAt,
        endsAt,
        reason: input.reason ?? null,
        createdById,
      },
      include: { professional: { select: { displayName: true } } },
    });
  });
  return toTimeBlockDTO(block);
}

export async function deleteBlock(scope: BlockScope, blockId: string) {
  const block = await prisma.timeBlock.findFirst({ where: { id: blockId, ...scopeWhere(scope) } });
  if (!block) throw notFound('Bloqueo no encontrado');
  await prisma.timeBlock.delete({ where: { id: block.id } });
}

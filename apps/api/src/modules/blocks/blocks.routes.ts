import { Router, type Request } from 'express';
import { dateRangeQuerySchema, timeBlockCreateSchema } from '@turnify/shared';
import { permissionDenied } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { parse, parseId } from '../../lib/validate';
import { getAdminBusinessId, getAuth, getProfessionalContext } from '../../middleware/auth';
import * as blocksService from './blocks.service';

async function businessTimezone(businessId: string): Promise<string> {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { timezone: true },
  });
  return business.timezone;
}

/** Mounted under /api/admin/blocks. */
export const adminBlocksRouter = Router();

adminBlocksRouter.get('/', async (req, res) => {
  const businessId = getAdminBusinessId(req);
  const query = parse(dateRangeQuerySchema, req.query);
  const items = await blocksService.listBlocks(
    { kind: 'admin', businessId },
    query,
    await businessTimezone(businessId),
  );
  res.json({ items });
});

adminBlocksRouter.post('/', async (req, res) => {
  const input = parse(timeBlockCreateSchema, req.body);
  const block = await blocksService.createBlock(
    { kind: 'admin', businessId: getAdminBusinessId(req) },
    input,
    getAuth(req).userId,
  );
  res.status(201).json({ block });
});

adminBlocksRouter.delete('/:id', async (req, res) => {
  await blocksService.deleteBlock(
    { kind: 'admin', businessId: getAdminBusinessId(req) },
    parseId(req.params.id),
  );
  res.status(204).end();
});

/** RN-033: professionals manage their own blocks only when the admin allowed it. */
function professionalScope(req: Request, requirePermission: boolean) {
  const professional = getProfessionalContext(req);
  if (requirePermission && !professional.canManageBlocks) {
    throw permissionDenied('No tienes permiso para gestionar bloqueos');
  }
  return {
    kind: 'professional' as const,
    businessId: professional.businessId,
    professionalId: professional.id,
  };
}

/** Mounted under /api/pro/blocks. */
export const proBlocksRouter = Router();

proBlocksRouter.get('/', async (req, res) => {
  const scope = professionalScope(req, false);
  const query = parse(dateRangeQuerySchema, req.query);
  const items = await blocksService.listBlocks(
    scope,
    query,
    await businessTimezone(scope.businessId),
  );
  res.json({ items });
});

proBlocksRouter.post('/', async (req, res) => {
  const scope = professionalScope(req, true);
  // The professional can only block its own agenda: the id is forced from the session.
  const input = parse(timeBlockCreateSchema, { ...req.body, professionalId: scope.professionalId });
  const block = await blocksService.createBlock(scope, input, getAuth(req).userId);
  res.status(201).json({ block });
});

proBlocksRouter.delete('/:id', async (req, res) => {
  await blocksService.deleteBlock(professionalScope(req, true), parseId(req.params.id));
  res.status(204).end();
});

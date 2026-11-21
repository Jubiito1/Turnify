import { Router } from 'express';
import {
  assignServicesSchema,
  professionalCreateSchema,
  professionalUpdateSchema,
  workingHoursSchema,
} from '@turnify/shared';
import { parse, parseId } from '../../lib/validate';
import { getAdminBusinessId } from '../../middleware/auth';
import * as professionalsService from './professionals.service';

/** Mounted under /api/admin/professionals. */
export const adminProfessionalsRouter = Router();

adminProfessionalsRouter.get('/', async (req, res) => {
  res.json({ items: await professionalsService.listProfessionals(getAdminBusinessId(req)) });
});

adminProfessionalsRouter.post('/', async (req, res) => {
  const input = parse(professionalCreateSchema, req.body);
  const professional = await professionalsService.createProfessional(
    getAdminBusinessId(req),
    input,
  );
  res.status(201).json({ professional });
});

adminProfessionalsRouter.get('/:id', async (req, res) => {
  const professional = await professionalsService.getProfessional(
    getAdminBusinessId(req),
    parseId(req.params.id),
  );
  res.json({ professional });
});

adminProfessionalsRouter.patch('/:id', async (req, res) => {
  const input = parse(professionalUpdateSchema, req.body);
  const professional = await professionalsService.updateProfessional(
    getAdminBusinessId(req),
    parseId(req.params.id),
    input,
  );
  res.json({ professional });
});

adminProfessionalsRouter.put('/:id/services', async (req, res) => {
  const input = parse(assignServicesSchema, req.body);
  const professional = await professionalsService.assignServices(
    getAdminBusinessId(req),
    parseId(req.params.id),
    input,
  );
  res.json({ professional });
});

adminProfessionalsRouter.put('/:id/working-hours', async (req, res) => {
  const input = parse(workingHoursSchema, req.body);
  const professional = await professionalsService.setWorkingHours(
    getAdminBusinessId(req),
    parseId(req.params.id),
    input,
  );
  res.json({ professional });
});

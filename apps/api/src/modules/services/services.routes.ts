import { Router } from 'express';
import { serviceCreateSchema, serviceUpdateSchema } from '@turnify/shared';
import { parse, parseId } from '../../lib/validate';
import { getAdminBusinessId } from '../../middleware/auth';
import * as servicesService from './services.service';

/** Mounted under /api/admin/services. */
export const adminServicesRouter = Router();

adminServicesRouter.get('/', async (req, res) => {
  res.json({ items: await servicesService.listServices(getAdminBusinessId(req)) });
});

adminServicesRouter.post('/', async (req, res) => {
  const input = parse(serviceCreateSchema, req.body);
  res
    .status(201)
    .json({ service: await servicesService.createService(getAdminBusinessId(req), input) });
});

adminServicesRouter.patch('/:id', async (req, res) => {
  const input = parse(serviceUpdateSchema, req.body);
  const service = await servicesService.updateService(
    getAdminBusinessId(req),
    parseId(req.params.id),
    input,
  );
  res.json({ service });
});

adminServicesRouter.delete('/:id', async (req, res) => {
  await servicesService.deleteService(getAdminBusinessId(req), parseId(req.params.id));
  res.status(204).end();
});

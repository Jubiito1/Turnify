import { Router } from 'express';
import { businessSettingsSchema } from '@turnify/shared';
import { parse } from '../../lib/validate';
import { getAdminBusinessId } from '../../middleware/auth';
import * as businessService from './business.service';

/** Mounted under /api/admin/business (admin-only router). */
export const adminBusinessRouter = Router();

adminBusinessRouter.get('/', async (req, res) => {
  res.json({ business: await businessService.getBusiness(getAdminBusinessId(req)) });
});

adminBusinessRouter.put('/', async (req, res) => {
  const input = parse(businessSettingsSchema, req.body);
  res.json({ business: await businessService.updateBusiness(getAdminBusinessId(req), input) });
});

import { Router } from 'express';
import {
  availabilityQuerySchema,
  availabilitySummaryQuerySchema,
  businessListQuerySchema,
} from '@turnify/shared';
import { parse } from '../../lib/validate';
import * as availabilityService from '../availability/availability.service';
import * as catalogService from './catalog.service';

/** Public catalog mounted under /api/businesses. */
export const catalogRouter = Router();

catalogRouter.get('/', async (req, res) => {
  const query = parse(businessListQuerySchema, req.query);
  res.json(await catalogService.listBusinesses(query));
});

catalogRouter.get('/:slug', async (req, res) => {
  res.json(await catalogService.getBusinessPage(req.params.slug));
});

catalogRouter.get('/:slug/availability', async (req, res) => {
  const query = parse(availabilityQuerySchema, req.query);
  res.json(await availabilityService.getAvailability(req.params.slug, query));
});

catalogRouter.get('/:slug/availability/summary', async (req, res) => {
  const query = parse(availabilitySummaryQuerySchema, req.query);
  res.json(await availabilityService.getAvailabilitySummary(req.params.slug, query));
});

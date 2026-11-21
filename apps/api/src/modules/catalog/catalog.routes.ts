import { Router } from 'express';
import { businessListQuerySchema } from '@turnify/shared';
import { parse } from '../../lib/validate';
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

import { Router } from 'express';
import { statsQuerySchema } from '@turnify/shared';
import { parse } from '../../lib/validate';
import { getAdminBusinessId } from '../../middleware/auth';
import { getStats } from './stats.service';

/** Mounted under /api/admin/stats. */
export const adminStatsRouter = Router();

adminStatsRouter.get('/', async (req, res) => {
  const query = parse(statsQuerySchema, req.query);
  res.json({ stats: await getStats(getAdminBusinessId(req), query) });
});

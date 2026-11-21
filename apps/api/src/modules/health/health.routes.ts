import { Router } from 'express';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';

const startedAt = new Date();

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  let database: 'ok' | 'unavailable' = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    logger.error({ err: error }, 'Health check: database unavailable');
    database = 'unavailable';
  }

  res.status(database === 'ok' ? 200 : 503).json({
    status: database === 'ok' ? 'ok' : 'degraded',
    service: 'turnify-api',
    database,
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

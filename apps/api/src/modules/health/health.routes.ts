import { Router } from 'express';

const startedAt = new Date();

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'turnify-api',
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

import { Router, type RequestHandler } from 'express';
import { authenticate, requireRole } from './middleware/auth';
import { createAuthRouter } from './modules/auth/auth.routes';
import { adminBlocksRouter, proBlocksRouter } from './modules/blocks/blocks.routes';
import {
  adminBookingsRouter,
  adminClientsRouter,
  clientBookingsRouter,
  proBookingsRouter,
} from './modules/bookings/bookings.routes';
import { adminBusinessRouter } from './modules/business/business.routes';
import { catalogRouter } from './modules/catalog/catalog.routes';
import { healthRouter } from './modules/health/health.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { proProfileRouter } from './modules/pro/pro.routes';
import { adminProfessionalsRouter } from './modules/professionals/professionals.routes';
import { adminServicesRouter } from './modules/services/services.routes';
import { adminStatsRouter } from './modules/stats/stats.routes';

interface ApiRouterDeps {
  authRateLimiter: RequestHandler;
}

/** Composes every API module. Authorization is enforced here per router (RN-024). */
export function createApiRouter({ authRateLimiter }: ApiRouterDeps) {
  const api = Router();

  // Public
  api.use('/health', healthRouter);
  api.use('/auth', createAuthRouter(authRateLimiter));
  api.use('/businesses', catalogRouter);

  // Client self-service: only the client's own bookings (RN-009).
  api.use('/bookings', authenticate, requireRole('CLIENT'), clientBookingsRouter);

  // Any authenticated user: own in-app notifications.
  api.use('/notifications', authenticate, notificationsRouter);

  // Admin: every route requires an ADMIN session; resources are scoped to its business (RN-011).
  const admin = Router();
  admin.use(authenticate, requireRole('ADMIN'));
  admin.use('/business', adminBusinessRouter);
  admin.use('/services', adminServicesRouter);
  admin.use('/professionals', adminProfessionalsRouter);
  admin.use('/blocks', adminBlocksRouter);
  admin.use('/bookings', adminBookingsRouter);
  admin.use('/clients', adminClientsRouter);
  admin.use('/stats', adminStatsRouter);
  api.use('/admin', admin);

  // Professional panel: only the professional's own agenda (RN-010).
  const pro = Router();
  pro.use(authenticate, requireRole('PROFESSIONAL'));
  pro.use('/me', proProfileRouter);
  pro.use('/blocks', proBlocksRouter);
  pro.use('/bookings', proBookingsRouter);
  api.use('/pro', pro);

  return api;
}

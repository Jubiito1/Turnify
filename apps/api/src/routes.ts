import { Router, type RequestHandler } from 'express';
import { authenticate, requireRole } from './middleware/auth';
import { createAuthRouter } from './modules/auth/auth.routes';
import { adminBlocksRouter, proBlocksRouter } from './modules/blocks/blocks.routes';
import { adminBookingsRouter, clientBookingsRouter } from './modules/bookings/bookings.routes';
import { adminBusinessRouter } from './modules/business/business.routes';
import { catalogRouter } from './modules/catalog/catalog.routes';
import { healthRouter } from './modules/health/health.routes';
import { adminProfessionalsRouter } from './modules/professionals/professionals.routes';
import { adminServicesRouter } from './modules/services/services.routes';

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

  // Admin: every route requires an ADMIN session; resources are scoped to its business (RN-011).
  const admin = Router();
  admin.use(authenticate, requireRole('ADMIN'));
  admin.use('/business', adminBusinessRouter);
  admin.use('/services', adminServicesRouter);
  admin.use('/professionals', adminProfessionalsRouter);
  admin.use('/blocks', adminBlocksRouter);
  admin.use('/bookings', adminBookingsRouter);
  api.use('/admin', admin);

  // Professional panel: only the professional's own agenda (RN-010).
  const pro = Router();
  pro.use(authenticate, requireRole('PROFESSIONAL'));
  pro.use('/blocks', proBlocksRouter);
  api.use('/pro', pro);

  return api;
}

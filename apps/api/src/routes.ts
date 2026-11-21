import { Router, type RequestHandler } from 'express';
import { authenticate, requireRole } from './middleware/auth';
import { createAuthRouter } from './modules/auth/auth.routes';
import { adminBusinessRouter } from './modules/business/business.routes';
import { catalogRouter } from './modules/catalog/catalog.routes';
import { healthRouter } from './modules/health/health.routes';
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

  // Admin: every route requires an ADMIN session; resources are scoped to its business (RN-011).
  const admin = Router();
  admin.use(authenticate, requireRole('ADMIN'));
  admin.use('/business', adminBusinessRouter);
  admin.use('/services', adminServicesRouter);
  api.use('/admin', admin);

  return api;
}

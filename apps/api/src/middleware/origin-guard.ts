import type { RequestHandler } from 'express';
import { forbidden } from '../lib/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defense in depth (the session cookie is already SameSite=Lax): state-changing requests that
 * carry an Origin header must come from an allowed origin or from the API's own host.
 */
export function createOriginGuard(allowedOrigins: string[]): RequestHandler {
  return (req, _res, next) => {
    const origin = req.get('origin');
    if (SAFE_METHODS.has(req.method) || !origin) return next();
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return next(forbidden('Origen de la solicitud no permitido'));
    }
    if (allowedOrigins.includes(origin) || originHost === req.get('host')) return next();
    next(forbidden('Origen de la solicitud no permitido'));
  };
}

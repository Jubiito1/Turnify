import { rateLimit } from 'express-rate-limit';

/** RN-032: limits authentication attempts per IP to slow down brute-force attacks. */
export function createAuthRateLimiter(max: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
        },
      });
    },
  });
}

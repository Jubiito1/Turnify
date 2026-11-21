import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env, isTest } from './config/env';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { createAuthRateLimiter } from './middleware/rate-limit';
import { createApiRouter } from './routes';

export interface AppOptions {
  /** Overrides AUTH_RATE_LIMIT_MAX (used by tests). */
  authRateLimitMax?: number;
}

export function createApp(options: AppOptions = {}) {
  const app = express();

  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      // Same-origin requests (no Origin header, or proxied via /api) are always allowed;
      // cross-origin browsers only from the configured allow-list.
      origin: (origin, callback) => {
        if (!origin || env.CORS_ORIGINS.includes(origin)) callback(null, true);
        else callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (!isTest) {
    app.use(
      pinoHttp({
        logger,
        serializers: {
          req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
          res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
        },
      }),
    );
  }

  const authRateLimiter = createAuthRateLimiter(
    options.authRateLimitMax ?? env.AUTH_RATE_LIMIT_MAX,
  );
  app.use('/api', createApiRouter({ authRateLimiter }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

import { execSync } from 'node:child_process';
import { apiRoot, migrate, startPostgres } from './embedded-pg';

/**
 * Full backend stack for end-to-end tests: ephemeral PostgreSQL + real migrations + demo seed +
 * the API server. Started by Playwright's webServer; never touches any persistent database.
 */
const DB_PORT = Number(process.env.E2E_DB_PORT ?? 5544);
const pg = await startPostgres({ port: DB_PORT, database: 'turnify_e2e' });
migrate(pg.url);
execSync('npx tsx prisma/seed.ts', {
  cwd: apiRoot,
  env: { ...process.env, DATABASE_URL: pg.url, SEED_RESET: 'true' },
  stdio: 'inherit',
});

process.env.DATABASE_URL = pg.url;
process.env.NODE_ENV = 'development';
process.env.PORT = process.env.E2E_API_PORT ?? '4400';
process.env.JWT_SECRET ??= 'e2e-secret-e2e-secret-e2e-secret-e2e-0123';
process.env.AUTH_RATE_LIMIT_MAX ??= '1000';
process.env.LOG_LEVEL ??= 'warn';

await import('../src/server');

const shutdown = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

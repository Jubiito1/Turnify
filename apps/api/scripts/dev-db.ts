import path from 'node:path';
import { apiRoot, startPostgres } from './embedded-pg';

/**
 * Local development database without Docker.
 * Data persists in apps/api/.pgdata (git-ignored). Stop with Ctrl+C.
 */
const port = Number(process.env.DEV_DB_PORT ?? 5433);

const pg = await startPostgres({
  port,
  database: 'turnify',
  dataDir: path.join(apiRoot, '.pgdata'),
});

console.warn(`PostgreSQL ready at ${pg.url}`);
console.warn('Next: npm run db:migrate && npm run db:seed (in another terminal). Ctrl+C to stop.');

const shutdown = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Keep the process alive while the server runs.
setInterval(() => undefined, 1 << 30);

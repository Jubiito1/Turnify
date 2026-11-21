import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

/**
 * Starts a real PostgreSQL server from npm binaries (no Docker required).
 * Used by integration tests, E2E tests and local development.
 */

export const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export interface StartedPostgres {
  url: string;
  stop: () => Promise<void>;
}

interface StartOptions {
  port: number;
  database: string;
  /** Persistent data directory; when omitted a temporary directory is used and removed on stop. */
  dataDir?: string;
}

export async function startPostgres({
  port,
  database,
  dataDir,
}: StartOptions): Promise<StartedPostgres> {
  const persistent = Boolean(dataDir);
  const databaseDir = dataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'turnify-pg-'));
  const alreadyInitialised = fs.existsSync(path.join(databaseDir, 'PG_VERSION'));

  const pg = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'postgres',
    port,
    // Always keep files on stop; temporary directories are removed by us (Windows-safe retries).
    persistent: true,
    onLog: () => undefined,
    onError: () => undefined,
  });

  if (!alreadyInitialised) {
    if (!persistent) fs.rmSync(databaseDir, { recursive: true, force: true });
    await pg.initialise();
  }
  await pg.start();

  const client = pg.getPgClient();
  await client.connect();
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
  if (exists.rowCount === 0) await client.query(`CREATE DATABASE "${database}"`);
  await client.end();

  return {
    url: `postgresql://postgres:postgres@localhost:${port}/${database}`,
    stop: async () => {
      await pg.stop();
      if (!persistent) {
        try {
          fs.rmSync(databaseDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
        } catch {
          // A locked temp directory on Windows is harmless; the OS cleans it up later.
        }
      }
    },
  };
}

/** Applies all Prisma migrations to the given database. */
export function migrate(databaseUrl: string): void {
  execSync('npx prisma migrate deploy', {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}

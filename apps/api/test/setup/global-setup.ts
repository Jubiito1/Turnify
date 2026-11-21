import type { TestProject } from 'vitest/node';
import { migrate, startPostgres, type StartedPostgres } from '../../scripts/embedded-pg';

let postgres: StartedPostgres | undefined;

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** Starts an isolated, ephemeral PostgreSQL and applies the real migrations once per test run. */
export async function setup(project: TestProject) {
  const port = 55000 + Math.floor(Math.random() * 1000);
  postgres = await startPostgres({ port, database: 'turnify_test' });
  migrate(postgres.url);
  project.provide('databaseUrl', postgres.url);
}

export async function teardown() {
  await postgres?.stop();
}

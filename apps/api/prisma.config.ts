import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma CLI does not auto-load .env when a config file exists: load the repository root .env.
// Real environment variables (CI, Render) take precedence because dotenv never overrides them.
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
});

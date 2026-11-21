import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    setupFiles: ['./test/setup/env-setup.ts'],
    // Integration tests share one ephemeral database and reset it between tests.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      // Placeholder; replaced in env-setup.ts with the ephemeral database URL.
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5499/turnify_test',
      JWT_SECRET: 'test-secret-that-is-long-enough-for-hs256-signing',
      CORS_ORIGINS: 'http://localhost:5173',
      AUTH_RATE_LIMIT_MAX: '1000',
    },
  },
});

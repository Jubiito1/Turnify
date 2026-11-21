import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      // Placeholder; integration tests override it with an ephemeral PostgreSQL instance.
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5499/turnify_test',
      JWT_SECRET: 'test-secret-that-is-long-enough-for-hs256-signing',
      CORS_ORIGINS: 'http://localhost:5173',
      AUTH_RATE_LIMIT_MAX: '1000',
    },
  },
});

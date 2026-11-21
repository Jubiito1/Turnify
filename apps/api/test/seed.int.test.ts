import { execSync } from 'node:child_process';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './helpers/db';

/** The demo seed must satisfy every database constraint (overlaps, ranges, client agenda). */
describe('demo seed', () => {
  afterAll(() => resetDb());

  it('loads consistent demo data into a real database', { timeout: 120_000 }, async () => {
    execSync('npx tsx prisma/seed.ts', {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, SEED_RESET: 'true' },
      stdio: 'pipe',
    });

    expect(await prisma.business.count()).toBe(4);
    expect(await prisma.booking.count()).toBeGreaterThan(100);
    const demoClient = await prisma.user.findUnique({ where: { email: 'cliente@turnify.demo' } });
    expect(demoClient?.role).toBe('CLIENT');
    const demoPro = await prisma.user.findUnique({
      where: { email: 'pro@turnify.demo' },
      include: { professional: true },
    });
    expect(demoPro?.professional?.canManageBlocks).toBe(true);
    const upcoming = await prisma.booking.count({
      where: {
        clientId: demoClient!.id,
        startsAt: { gt: new Date() },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });
    expect(upcoming).toBeGreaterThan(0);
  });
});

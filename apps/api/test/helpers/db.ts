import { prisma } from '../../src/lib/prisma';

/** Removes all rows between tests. Only ever runs against the ephemeral test database. */
export async function resetDb(): Promise<void> {
  if (!process.env.DATABASE_URL?.includes('turnify_test')) {
    throw new Error('resetDb refused to run outside the test database');
  }
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Notification", "Booking", "TimeBlock", "WorkingHours", "ProfessionalService", "Professional", "Service", "Business", "User" RESTART IDENTITY CASCADE',
  );
}

export { prisma };

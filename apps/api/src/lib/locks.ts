import type { Prisma } from '@prisma/client';

/**
 * Serializes writes that affect one professional's agenda (bookings vs. blocks) by locking the
 * professional row for the rest of the transaction. Overlaps between bookings are additionally
 * guaranteed by the EXCLUDE constraint; this lock covers cross-table rules (RN-005, RN-029).
 */
export async function lockProfessional(
  tx: Prisma.TransactionClient,
  professionalId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Professional" WHERE id = ${professionalId}::uuid FOR UPDATE`;
}

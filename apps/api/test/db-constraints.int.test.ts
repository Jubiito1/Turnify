import { beforeEach, describe, expect, it } from 'vitest';
import { isConstraintViolation, isExclusionViolation } from '../src/lib/db-errors';
import { prisma, resetDb } from './helpers/db';
import { createBusiness, createProfessional, createService, createUser } from './helpers/factories';

/**
 * Verifies that PostgreSQL itself enforces the critical invariants, independently of
 * application code (RN-006, RN-012, RN-018, RN-020, RN-028, RN-030).
 */
describe('database constraints', () => {
  let ids: { businessId: string; serviceId: string; professionalId: string; clientId: string };

  beforeEach(async () => {
    await resetDb();
    const { business } = await createBusiness();
    const service = await createService(business.id);
    const { professional } = await createProfessional(business.id, [service.id]);
    const client = await createUser();
    ids = {
      businessId: business.id,
      serviceId: service.id,
      professionalId: professional.id,
      clientId: client.id,
    };
  });

  const booking = (startsAt: string, endsAt: string, overrides: Record<string, unknown> = {}) =>
    prisma.booking.create({
      data: {
        ...ids,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        priceCents: 1000,
        status: 'CONFIRMED',
        ...overrides,
      },
    });

  it('rejects overlapping active bookings for the same professional (RN-006)', async () => {
    await booking('2030-01-07T13:00:00Z', '2030-01-07T13:30:00Z');
    const otherClient = await createUser();
    const error = await booking('2030-01-07T13:15:00Z', '2030-01-07T13:45:00Z', {
      clientId: otherClient.id,
    }).catch((e: unknown) => e);
    expect(isExclusionViolation(error)).toBe(true);
    expect(isConstraintViolation(error, 'booking_no_overlap')).toBe(true);
  });

  it('allows back-to-back bookings (half-open ranges)', async () => {
    await booking('2030-01-07T13:00:00Z', '2030-01-07T13:30:00Z');
    const otherClient = await createUser();
    await expect(
      booking('2030-01-07T13:30:00Z', '2030-01-07T14:00:00Z', { clientId: otherClient.id }),
    ).resolves.toBeDefined();
  });

  it('ignores cancelled bookings in the overlap check (RN-012)', async () => {
    await booking('2030-01-07T13:00:00Z', '2030-01-07T13:30:00Z', { status: 'CANCELLED' });
    await expect(booking('2030-01-07T13:00:00Z', '2030-01-07T13:30:00Z')).resolves.toBeDefined();
  });

  it('rejects overlapping active bookings for the same client (RN-028)', async () => {
    await booking('2030-01-07T13:00:00Z', '2030-01-07T13:30:00Z');
    const service = await createService(ids.businessId);
    const { professional } = await createProfessional(ids.businessId, [service.id]);
    const error = await booking('2030-01-07T13:10:00Z', '2030-01-07T13:40:00Z', {
      professionalId: professional.id,
      serviceId: service.id,
    }).catch((e: unknown) => e);
    expect(isConstraintViolation(error, 'booking_client_no_overlap')).toBe(true);
  });

  it('allows only one of many concurrent inserts for the same slot (RN-020)', async () => {
    const clients = await Promise.all(Array.from({ length: 8 }, () => createUser()));
    const results = await Promise.allSettled(
      clients.map((client) =>
        booking('2030-01-08T15:00:00Z', '2030-01-08T15:30:00Z', { clientId: client.id }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected).toHaveLength(7);
    expect(rejected.every((r) => isExclusionViolation(r.reason))).toBe(true);
  });

  it('rejects negative prices and inverted ranges (RN-018)', async () => {
    await expect(
      prisma.service.create({
        data: { businessId: ids.businessId, name: 'Bad', durationMinutes: 30, priceCents: -1 },
      }),
    ).rejects.toThrow();
    await expect(booking('2030-01-07T14:00:00Z', '2030-01-07T13:00:00Z')).rejects.toThrow();
  });

  it('rejects overlapping working hours on the same weekday (RN-030)', async () => {
    await expect(
      prisma.workingHours.create({
        data: { professionalId: ids.professionalId, weekday: 1, startMinute: 600, endMinute: 700 },
      }),
    ).rejects.toThrow();
  });

  it('rejects non-lowercase emails (RN-031)', async () => {
    await expect(
      prisma.user.create({ data: { email: 'Upper@Test.dev', name: 'X', passwordHash: 'x' } }),
    ).rejects.toThrow();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './helpers/db';
import { createBusiness, createProfessional, createService, createUser } from './helpers/factories';
import { app, request } from './helpers/http';
import { localTime, nextWeekday } from './helpers/time';

describe('availability endpoint (T10)', () => {
  let slug: string;
  let businessId: string;
  let serviceId: string;
  let professionalId: string;
  const monday = nextWeekday(1);

  beforeEach(async () => {
    await resetDb();
    // Mon–Sat 09:00–18:00, 15 min interval, 30 min service
    const { business } = await createBusiness({ slotIntervalMinutes: 15 });
    const service = await createService(business.id, { durationMinutes: 30 });
    const { professional } = await createProfessional(business.id, [service.id]);
    slug = business.slug;
    businessId = business.id;
    serviceId = service.id;
    professionalId = professional.id;
  });

  const getSlots = (query: Record<string, string>) =>
    request(app)
      .get(`/api/businesses/${slug}/availability`)
      .query({ serviceId, date: monday, ...query });

  async function book(startsAt: string, status: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED') {
    const client = await createUser();
    const start = new Date(startsAt);
    return prisma.booking.create({
      data: {
        businessId,
        serviceId,
        professionalId,
        clientId: client.id,
        startsAt: start,
        endsAt: new Date(start.getTime() + 30 * 60_000),
        priceCents: 1000,
        status,
      },
    });
  }

  it('returns every aligned slot of a free working day (RN-008, RN-034)', async () => {
    const res = await getSlots({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      date: monday,
      timezone: 'America/Argentina/Buenos_Aires',
      durationMinutes: 30,
    });
    // (18:00 - 09:00 - 30 min) / 15 min + 1 = 35 starts
    expect(res.body.slots).toHaveLength(35);
    expect(res.body.slots[0]).toEqual({
      startsAt: localTime(monday, '09:00'),
      endsAt: localTime(monday, '09:30'),
      professionalIds: [professionalId],
    });
    expect(res.body.slots.at(-1).startsAt).toBe(localTime(monday, '17:30'));
  });

  it('removes slots taken by active bookings but not by cancelled ones (RN-006, RN-012)', async () => {
    await book(localTime(monday, '10:00'));
    await book(localTime(monday, '15:00'), 'CANCELLED');

    const starts: string[] = (await getSlots({})).body.slots.map(
      (s: { startsAt: string }) => s.startsAt,
    );
    // 09:45, 10:00 and 10:15 overlap the 10:00–10:30 booking
    expect(starts).not.toContain(localTime(monday, '09:45'));
    expect(starts).not.toContain(localTime(monday, '10:00'));
    expect(starts).not.toContain(localTime(monday, '10:15'));
    expect(starts).toContain(localTime(monday, '09:30'));
    expect(starts).toContain(localTime(monday, '10:30'));
    expect(starts).toContain(localTime(monday, '15:00'));
  });

  it('removes slots inside availability blocks (RN-005)', async () => {
    await prisma.timeBlock.create({
      data: {
        professionalId,
        startsAt: new Date(localTime(monday, '12:00')),
        endsAt: new Date(localTime(monday, '14:00')),
        reason: 'Trámite',
      },
    });
    const starts: string[] = (await getSlots({})).body.slots.map(
      (s: { startsAt: string }) => s.startsAt,
    );
    expect(starts).not.toContain(localTime(monday, '12:00'));
    expect(starts).not.toContain(localTime(monday, '13:45'));
    expect(starts).toContain(localTime(monday, '11:30'));
    expect(starts).toContain(localTime(monday, '14:00'));
  });

  it('returns no slots on non-working days', async () => {
    const res = await getSlots({ date: nextWeekday(0) });
    expect(res.body.slots).toEqual([]);
  });

  it('filters by professional and rejects non-eligible professionals (RN-003)', async () => {
    const other = await createService(businessId);
    const { professional: notEligible } = await createProfessional(businessId, [other.id]);

    expect((await getSlots({ professionalId })).body.slots).toHaveLength(35);
    const res = await getSlots({ professionalId: notEligible.id });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PROFESSIONAL_NOT_ELIGIBLE');
  });

  it('rejects inactive services and services of other businesses (RN-017, RN-025)', async () => {
    await prisma.service.update({ where: { id: serviceId }, data: { isActive: false } });
    const inactive = await getSlots({});
    expect(inactive.status).toBe(422);
    expect(inactive.body.error.code).toBe('SERVICE_INACTIVE');

    const { business: other } = await createBusiness();
    const foreign = await createService(other.id);
    expect((await getSlots({ serviceId: foreign.id })).status).toBe(404);
  });

  it('ignores inactive professionals (RN-023)', async () => {
    await prisma.professional.update({ where: { id: professionalId }, data: { isActive: false } });
    expect((await getSlots({})).body.slots).toEqual([]);
  });

  it('validates query parameters', async () => {
    expect((await getSlots({ date: '07/01/2030' })).status).toBe(400);
    expect((await getSlots({ serviceId: 'nope' })).status).toBe(400);
  });

  it('summarizes free slots per day', async () => {
    const res = await request(app)
      .get(`/api/businesses/${slug}/availability/summary`)
      .query({ serviceId, from: monday, days: 7 });
    expect(res.status).toBe(200);
    expect(res.body.days).toHaveLength(7);
    expect(res.body.days[0]).toEqual({ date: monday, slotCount: 35 });
    expect(res.body.days[6].slotCount).toBe(0); // Sunday
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './helpers/db';
import { createBusiness, createProfessional, createService, createUser } from './helpers/factories';
import { loginAs } from './helpers/http';
import { localTime, nextWeekday } from './helpers/time';

describe('booking creation (T12)', () => {
  let client: Awaited<ReturnType<typeof loginAs>>;
  let admin: Awaited<ReturnType<typeof loginAs>>;
  let businessId: string;
  let serviceId: string;
  let professionalId: string;
  const day = nextWeekday(3); // Wednesday, Mon–Sat 09:00–18:00

  beforeEach(async () => {
    await resetDb();
    const { business, owner } = await createBusiness();
    const service = await createService(business.id, { durationMinutes: 45, priceCents: 250000 });
    const { professional } = await createProfessional(business.id, [service.id]);
    businessId = business.id;
    serviceId = service.id;
    professionalId = professional.id;
    await createUser({ email: 'client@test.dev' });
    client = await loginAs('client@test.dev');
    admin = await loginAs(owner.email);
  });

  const book = (hhmm: string, extra: Record<string, unknown> = {}, agent = client) =>
    agent.post('/api/bookings').send({
      serviceId,
      professionalId,
      startsAt: localTime(day, hhmm),
      ...extra,
    });

  it('creates a pending booking with server-computed end and price snapshot (RN-007, RN-018)', async () => {
    const res = await book('10:00', {
      notes: 'Primera vez',
      endsAt: localTime(day, '17:00'), // ignored: the server computes the end
    });
    expect(res.status).toBe(201);
    expect(res.body.booking).toMatchObject({
      status: 'PENDING',
      startsAt: localTime(day, '10:00'),
      endsAt: localTime(day, '10:45'),
      priceCents: 250000,
      notes: 'Primera vez',
      service: { id: serviceId, durationMinutes: 45 },
      professional: { id: professionalId },
      client: { email: 'client@test.dev' },
    });

    await prisma.service.update({ where: { id: serviceId }, data: { priceCents: 999999 } });
    const detail = await client.get(`/api/bookings/${res.body.booking.id}`);
    expect(detail.body.booking.priceCents).toBe(250000);
  });

  it('auto-confirms when the business is configured to', async () => {
    await prisma.business.update({ where: { id: businessId }, data: { autoConfirm: true } });
    expect((await book('10:00')).body.booking.status).toBe('CONFIRMED');
  });

  it('rejects bookings in the past (RN-001)', async () => {
    const res = await client.post('/api/bookings').send({
      serviceId,
      professionalId,
      startsAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BOOKING_IN_PAST');
  });

  it('rejects bookings beyond the booking horizon (RN-027)', async () => {
    await prisma.business.update({ where: { id: businessId }, data: { bookingHorizonDays: 1 } });
    const res = await book('10:00');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BEYOND_BOOKING_HORIZON');
  });

  it.each([
    ['outside working hours', '19:00'],
    ['ending after closing time', '17:30'],
    ['misaligned with the slot interval', '10:07'],
  ])('rejects slots %s (RN-004, RN-034)', async (_label, hhmm) => {
    const res = await book(hhmm);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
  });

  it('rejects slots inside a block (RN-005)', async () => {
    await prisma.timeBlock.create({
      data: {
        professionalId,
        startsAt: new Date(localTime(day, '09:00')),
        endsAt: new Date(localTime(day, '12:00')),
      },
    });
    expect((await book('11:30')).body.error.code).toBe('SLOT_UNAVAILABLE');
    expect((await book('12:00')).status).toBe(201);
  });

  it('rejects overlapping bookings for the professional but allows contiguous ones (RN-006)', async () => {
    expect((await book('10:00')).status).toBe(201);

    await createUser({ email: 'other@test.dev' });
    const other = await loginAs('other@test.dev');
    const overlap = await book('10:30', {}, other);
    expect(overlap.status).toBe(409);
    expect(overlap.body.error.code).toBe('SLOT_TAKEN');
    expect((await book('10:45', {}, other)).status).toBe(201);
  });

  it('frees the slot when the existing booking is cancelled (RN-012)', async () => {
    const first = await book('10:00');
    await prisma.booking.update({
      where: { id: first.body.booking.id },
      data: { status: 'CANCELLED' },
    });
    await createUser({ email: 'other@test.dev' });
    expect((await book('10:00', {}, await loginAs('other@test.dev'))).status).toBe(201);
  });

  it('prevents a client from double-booking itself across businesses (RN-028)', async () => {
    expect((await book('10:00')).status).toBe(201);
    const { business: other } = await createBusiness();
    const otherService = await createService(other.id, { durationMinutes: 30 });
    const { professional: otherPro } = await createProfessional(other.id, [otherService.id]);
    const res = await client.post('/api/bookings').send({
      serviceId: otherService.id,
      professionalId: otherPro.id,
      startsAt: localTime(day, '10:15'),
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CLIENT_OVERLAP');
  });

  it('rejects inactive services (RN-002, RN-017)', async () => {
    await prisma.service.update({ where: { id: serviceId }, data: { isActive: false } });
    const res = await book('10:00');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('SERVICE_INACTIVE');
  });

  it('rejects professionals not enabled for the service or from another business (RN-003, RN-025)', async () => {
    const otherService = await createService(businessId);
    const { professional: notEnabled } = await createProfessional(businessId, [otherService.id]);
    const res = await book('10:00', { professionalId: notEnabled.id });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PROFESSIONAL_NOT_ELIGIBLE');

    const { business: other } = await createBusiness();
    const { professional: foreign } = await createProfessional(other.id, []);
    expect((await book('10:00', { professionalId: foreign.id })).status).toBe(422);

    await prisma.professional.update({ where: { id: professionalId }, data: { isActive: false } });
    expect((await book('10:00')).body.error.code).toBe('PROFESSIONAL_NOT_ELIGIBLE');
  });

  it('only allows clients to use the client booking endpoint (RN-024)', async () => {
    expect((await book('10:00', {}, admin)).status).toBe(403);
  });

  it("hides other clients' bookings (RN-009, RN-021)", async () => {
    const res = await book('10:00');
    await createUser({ email: 'other@test.dev' });
    const other = await loginAs('other@test.dev');
    expect((await other.get(`/api/bookings/${res.body.booking.id}`)).status).toBe(404);
  });

  describe('admin bookings', () => {
    it('books for a new guest client, confirmed immediately', async () => {
      const res = await admin.post('/api/admin/bookings').send({
        serviceId,
        professionalId,
        startsAt: localTime(day, '15:00'),
        client: { name: 'Cliente Mostrador', email: 'walkin@test.dev' },
      });
      expect(res.status).toBe(201);
      expect(res.body.booking).toMatchObject({
        status: 'CONFIRMED',
        client: { email: 'walkin@test.dev' },
      });
      const guest = await prisma.user.findUniqueOrThrow({ where: { email: 'walkin@test.dev' } });
      expect(guest.passwordHash).toBeNull();
    });

    it("cannot use another business' service (RN-011, RN-025)", async () => {
      const { business: other } = await createBusiness();
      const foreign = await createService(other.id);
      const res = await admin.post('/api/admin/bookings').send({
        serviceId: foreign.id,
        professionalId,
        startsAt: localTime(day, '15:00'),
        client: { name: 'X Y', email: 'x@test.dev' },
      });
      expect(res.status).toBe(404);
    });
  });
});

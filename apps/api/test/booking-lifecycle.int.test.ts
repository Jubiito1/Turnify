import type { BookingStatus } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './helpers/db';
import { createBusiness, createProfessional, createService, createUser } from './helpers/factories';
import { app, loginAs, request } from './helpers/http';
import { localTime, nextWeekday } from './helpers/time';

describe('booking lifecycle (T13)', () => {
  let client: Awaited<ReturnType<typeof loginAs>>;
  let admin: Awaited<ReturnType<typeof loginAs>>;
  let businessId: string;
  let slug: string;
  let serviceId: string;
  let professionalId: string;
  let clientId: string;
  const day = nextWeekday(3);

  beforeEach(async () => {
    await resetDb();
    const { business, owner } = await createBusiness({ cancellationMinHours: 24 });
    const service = await createService(business.id, { durationMinutes: 30 });
    const { professional } = await createProfessional(business.id, [service.id]);
    businessId = business.id;
    slug = business.slug;
    serviceId = service.id;
    professionalId = professional.id;
    clientId = (await createUser({ email: 'client@test.dev' })).id;
    client = await loginAs('client@test.dev');
    admin = await loginAs(owner.email);
  });

  /** Inserts a booking directly (any time, any status) to set up lifecycle scenarios. */
  async function seedBooking(
    startsAt: Date,
    status: BookingStatus = 'CONFIRMED',
    ownerId = clientId,
  ) {
    return prisma.booking.create({
      data: {
        businessId,
        serviceId,
        professionalId,
        clientId: ownerId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 30 * 60_000),
        priceCents: 1000,
        status,
      },
    });
  }
  const inHours = (h: number) => new Date(Date.now() + h * 3_600_000);

  describe('client cancellation', () => {
    it('cancels with enough notice and frees the slot (RN-012, RN-013)', async () => {
      const created = await client
        .post('/api/bookings')
        .send({ serviceId, professionalId, startsAt: localTime(day, '10:00') });

      const res = await client
        .post(`/api/bookings/${created.body.booking.id}/cancel`)
        .send({ reason: 'Viaje' });
      expect(res.status).toBe(200);
      expect(res.body.booking).toMatchObject({ status: 'CANCELLED', cancellationReason: 'Viaje' });
      expect(res.body.booking.cancelledAt).not.toBeNull();

      const slots = await request(app)
        .get(`/api/businesses/${slug}/availability`)
        .query({ serviceId, date: day });
      expect(slots.body.slots.map((s: { startsAt: string }) => s.startsAt)).toContain(
        localTime(day, '10:00'),
      );
    });

    it('rejects cancellation inside the minimum notice window (RN-013)', async () => {
      const booking = await seedBooking(inHours(5));
      const res = await client.post(`/api/bookings/${booking.id}/cancel`).send({});
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('CANCELLATION_WINDOW_PASSED');
    });

    it('rejects cancelling twice (RN-015)', async () => {
      const booking = await seedBooking(inHours(72), 'CANCELLED');
      const res = await client.post(`/api/bookings/${booking.id}/cancel`).send({});
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
    });

    it("cannot cancel another client's booking by changing the id (RN-021)", async () => {
      const other = await createUser();
      const booking = await seedBooking(inHours(72), 'CONFIRMED', other.id);
      expect((await client.post(`/api/bookings/${booking.id}/cancel`).send({})).status).toBe(404);
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
        'CONFIRMED',
      );
    });
  });

  describe('rescheduling (RN-016)', () => {
    it('moves the booking to a free slot keeping its id, back to PENDING', async () => {
      const created = await client
        .post('/api/bookings')
        .send({ serviceId, professionalId, startsAt: localTime(day, '10:00') });
      await prisma.booking.update({
        where: { id: created.body.booking.id },
        data: { status: 'CONFIRMED' },
      });

      // Overlaps its own current time: must not collide with itself.
      const res = await client
        .post(`/api/bookings/${created.body.booking.id}/reschedule`)
        .send({ startsAt: localTime(day, '10:15') });
      expect(res.status).toBe(200);
      expect(res.body.booking).toMatchObject({
        id: created.body.booking.id,
        startsAt: localTime(day, '10:15'),
        endsAt: localTime(day, '10:45'),
        status: 'PENDING',
      });
    });

    it('re-validates availability: taken, blocked and past slots are rejected', async () => {
      const mine = await seedBooking(new Date(localTime(day, '10:00')));
      const other = await createUser();
      await seedBooking(new Date(localTime(day, '12:00')), 'CONFIRMED', other.id);
      await prisma.timeBlock.create({
        data: {
          professionalId,
          startsAt: new Date(localTime(day, '15:00')),
          endsAt: new Date(localTime(day, '16:00')),
        },
      });

      const taken = await client
        .post(`/api/bookings/${mine.id}/reschedule`)
        .send({ startsAt: localTime(day, '12:00') });
      expect(taken.status).toBe(409);
      expect(taken.body.error.code).toBe('SLOT_TAKEN');

      const blocked = await client
        .post(`/api/bookings/${mine.id}/reschedule`)
        .send({ startsAt: localTime(day, '15:30') });
      expect(blocked.body.error.code).toBe('SLOT_UNAVAILABLE');

      const past = await client
        .post(`/api/bookings/${mine.id}/reschedule`)
        .send({ startsAt: new Date(Date.now() - 3_600_000).toISOString() });
      expect(past.body.error.code).toBe('BOOKING_IN_PAST');

      // The booking stays untouched after the failed attempts.
      const after = await prisma.booking.findUniqueOrThrow({ where: { id: mine.id } });
      expect(after.startsAt.toISOString()).toBe(localTime(day, '10:00'));
    });

    it('only reschedules active bookings and respects the notice window', async () => {
      const cancelled = await seedBooking(inHours(72), 'CANCELLED');
      const res = await client
        .post(`/api/bookings/${cancelled.id}/reschedule`)
        .send({ startsAt: localTime(day, '11:00') });
      expect(res.body.error.code).toBe('BOOKING_NOT_ACTIVE');

      const soon = await seedBooking(inHours(3));
      const late = await client
        .post(`/api/bookings/${soon.id}/reschedule`)
        .send({ startsAt: localTime(day, '11:00') });
      expect(late.body.error.code).toBe('CANCELLATION_WINDOW_PASSED');
    });

    it('lets the admin move a booking to another eligible professional', async () => {
      const { professional: second } = await createProfessional(businessId, [serviceId], {
        displayName: 'Second',
      });
      const booking = await seedBooking(new Date(localTime(day, '10:00')));
      const res = await admin
        .post(`/api/admin/bookings/${booking.id}/reschedule`)
        .send({ startsAt: localTime(day, '11:00'), professionalId: second.id });
      expect(res.status).toBe(200);
      expect(res.body.booking).toMatchObject({
        professional: { id: second.id },
        status: 'CONFIRMED',
      });
    });
  });

  describe('admin status changes', () => {
    it('confirms a pending booking', async () => {
      const booking = await seedBooking(inHours(48), 'PENDING');
      const res = await admin
        .patch(`/api/admin/bookings/${booking.id}/status`)
        .send({ status: 'CONFIRMED' });
      expect(res.status).toBe(200);
      expect(res.body.booking.status).toBe('CONFIRMED');
    });

    it('cancels at any time, ignoring the client notice window', async () => {
      const booking = await seedBooking(inHours(1));
      const res = await admin
        .patch(`/api/admin/bookings/${booking.id}/status`)
        .send({ status: 'CANCELLED', reason: 'Profesional enfermo' });
      expect(res.body.booking).toMatchObject({
        status: 'CANCELLED',
        cancellationReason: 'Profesional enfermo',
      });
    });

    it('completes only started bookings (RN-026)', async () => {
      const future = await seedBooking(inHours(48));
      const early = await admin
        .patch(`/api/admin/bookings/${future.id}/status`)
        .send({ status: 'COMPLETED' });
      expect(early.body.error.code).toBe('BOOKING_NOT_STARTED');

      const past = await seedBooking(inHours(-3));
      const done = await admin
        .patch(`/api/admin/bookings/${past.id}/status`)
        .send({ status: 'COMPLETED' });
      expect(done.body.booking.status).toBe('COMPLETED');
    });

    it('never completes a cancelled booking (RN-014)', async () => {
      const booking = await seedBooking(inHours(-3), 'CANCELLED');
      const res = await admin
        .patch(`/api/admin/bookings/${booking.id}/status`)
        .send({ status: 'COMPLETED' });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
    });

    it("cannot change another business' bookings (RN-011)", async () => {
      const { business: other, owner } = await createBusiness();
      const service = await createService(other.id);
      const { professional } = await createProfessional(other.id, [service.id]);
      const foreign = await prisma.booking.create({
        data: {
          businessId: other.id,
          serviceId: service.id,
          professionalId: professional.id,
          clientId,
          startsAt: inHours(100),
          endsAt: inHours(101),
          priceCents: 1,
        },
      });
      expect(
        (
          await admin
            .patch(`/api/admin/bookings/${foreign.id}/status`)
            .send({ status: 'CONFIRMED' })
        ).status,
      ).toBe(404);
      expect(owner).toBeDefined();
    });
  });

  describe('professional status changes (RN-010, RN-033)', () => {
    it('completes its own started bookings when allowed', async () => {
      const { user, professional } = await createProfessional(businessId, [serviceId], {
        withAccount: true,
      });
      const pro = await loginAs(user!.email);
      const booking = await prisma.booking.create({
        data: {
          businessId,
          serviceId,
          professionalId: professional.id,
          clientId,
          startsAt: inHours(-2),
          endsAt: inHours(-1.5),
          priceCents: 1000,
          status: 'CONFIRMED',
        },
      });
      const res = await pro
        .patch(`/api/pro/bookings/${booking.id}/status`)
        .send({ status: 'NO_SHOW' });
      expect(res.status).toBe(200);
      expect(res.body.booking.status).toBe('NO_SHOW');
    });

    it('rejects other actions, missing permission and other professionals bookings', async () => {
      const { user, professional } = await createProfessional(businessId, [serviceId], {
        withAccount: true,
        canCompleteBookings: false,
      });
      const pro = await loginAs(user!.email);
      const own = await prisma.booking.create({
        data: {
          businessId,
          serviceId,
          professionalId: professional.id,
          clientId,
          startsAt: inHours(-2),
          endsAt: inHours(-1.5),
          priceCents: 1000,
          status: 'CONFIRMED',
        },
      });
      const noPermission = await pro
        .patch(`/api/pro/bookings/${own.id}/status`)
        .send({ status: 'COMPLETED' });
      expect(noPermission.status).toBe(403);
      expect(noPermission.body.error.code).toBe('PERMISSION_DENIED');

      const cancel = await pro
        .patch(`/api/pro/bookings/${own.id}/status`)
        .send({ status: 'CANCELLED' });
      expect(cancel.status).toBe(403);

      const othersBooking = await seedBooking(inHours(-2), 'CONFIRMED', (await createUser()).id);
      expect(
        (
          await pro
            .patch(`/api/pro/bookings/${othersBooking.id}/status`)
            .send({ status: 'COMPLETED' })
        ).status,
      ).toBe(404);
    });
  });
});

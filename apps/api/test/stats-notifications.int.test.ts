import type { BookingStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './helpers/db';
import { createBusiness, createProfessional, createService, createUser } from './helpers/factories';
import { loginAs } from './helpers/http';
import { TZ, localTime, nextWeekday } from './helpers/time';

describe('stats (T15, RN-022)', () => {
  let admin: Awaited<ReturnType<typeof loginAs>>;
  let businessId: string;

  beforeEach(async () => {
    await resetDb();
    const { business, owner } = await createBusiness();
    businessId = business.id;
    admin = await loginAs(owner.email);
  });

  it('computes totals, revenue, rates and breakdowns from persisted bookings', async () => {
    const cut = await createService(businessId, {
      name: 'Corte',
      priceCents: 100050,
      durationMinutes: 60,
    });
    const color = await createService(businessId, {
      name: 'Color',
      priceCents: 300000,
      durationMinutes: 60,
    });
    // Works Monday only 09:00–13:00 => 240 available minutes per Monday
    const { professional } = await createProfessional(businessId, [cut.id, color.id], {
      displayName: 'Ana',
      hours: [{ weekday: 1, startMinute: 540, endMinute: 780 }],
    });
    const monday = DateTime.fromISO(nextWeekday(1, -14), { zone: TZ }); // a past Monday
    const date = monday.toISODate()!;
    const clients = await Promise.all([createUser(), createUser(), createUser()]);

    const add = (
      hhmm: string,
      serviceId: string,
      priceCents: number,
      status: BookingStatus,
      clientId: string,
    ) =>
      prisma.booking.create({
        data: {
          businessId,
          serviceId,
          professionalId: professional.id,
          clientId,
          startsAt: new Date(localTime(date, hhmm)),
          endsAt: new Date(new Date(localTime(date, hhmm)).getTime() + 60 * 60_000),
          priceCents,
          status,
        },
      });
    await add('09:00', cut.id, 100050, 'COMPLETED', clients[0]!.id);
    await add('10:00', cut.id, 100050, 'COMPLETED', clients[1]!.id);
    await add('11:00', color.id, 300000, 'NO_SHOW', clients[2]!.id);
    await add('12:00', color.id, 300000, 'CANCELLED', clients[0]!.id);

    const res = await admin.get('/api/admin/stats').query({ from: date, to: date });
    expect(res.status).toBe(200);
    const { stats } = res.body;
    expect(stats.range).toEqual({ from: date, to: date });
    expect(stats.totals).toEqual({
      bookings: 4,
      active: 0,
      completed: 2,
      cancelled: 1,
      noShow: 1,
      revenueCents: 200100, // exact integer cents, only COMPLETED
      expectedRevenueCents: 0,
      uniqueClients: 3,
      cancellationRate: 0.25,
      occupancyRate: 0.75, // 180 booked minutes (non-cancelled) / 240 available
    });
    expect(stats.byService).toEqual([
      { serviceId: cut.id, name: 'Corte', bookings: 2, completed: 2, revenueCents: 200100 },
      { serviceId: color.id, name: 'Color', bookings: 1, completed: 0, revenueCents: 0 },
    ]);
    expect(stats.byProfessional[0]).toMatchObject({
      name: 'Ana',
      bookedMinutes: 180,
      availableMinutes: 240,
    });
    expect(stats.byDay).toEqual([{ date, bookings: 3, revenueCents: 200100 }]);
  });

  it('defaults to the last 30 days and validates the range', async () => {
    const res = await admin.get('/api/admin/stats');
    expect(res.body.stats.byDay).toHaveLength(30);
    expect(res.body.stats.totals.bookings).toBe(0);

    const bad = await admin.get('/api/admin/stats').query({ from: '2026-12-10', to: '2026-12-01' });
    expect(bad.status).toBe(422);
  });

  it("never mixes other businesses' data (RN-025)", async () => {
    const { business: other } = await createBusiness();
    const service = await createService(other.id);
    const { professional } = await createProfessional(other.id, [service.id]);
    const client = await createUser();
    const startsAt = new Date(Date.now() - 2 * 86_400_000);
    await prisma.booking.create({
      data: {
        businessId: other.id,
        serviceId: service.id,
        professionalId: professional.id,
        clientId: client.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 1_800_000),
        priceCents: 5000,
        status: 'COMPLETED',
      },
    });
    const res = await admin.get('/api/admin/stats');
    expect(res.body.stats.totals.bookings).toBe(0);
  });
});

describe('in-app notifications (T15)', () => {
  beforeEach(() => resetDb());

  it('notifies the business when a client books and the client when the admin confirms', async () => {
    const { business, owner } = await createBusiness();
    const service = await createService(business.id);
    const { professional, user: proUser } = await createProfessional(business.id, [service.id], {
      withAccount: true,
    });
    await createUser({ email: 'client@test.dev', name: 'Carla' });
    const client = await loginAs('client@test.dev');
    const admin = await loginAs(owner.email);
    const pro = await loginAs(proUser!.email);

    const created = await client.post('/api/bookings').send({
      serviceId: service.id,
      professionalId: professional.id,
      startsAt: localTime(nextWeekday(2), '10:00'),
    });
    expect(created.status).toBe(201);

    const adminInbox = await admin.get('/api/notifications');
    expect(adminInbox.body.unreadCount).toBe(1);
    expect(adminInbox.body.items[0]).toMatchObject({
      type: 'BOOKING_CREATED',
      title: 'Nueva reserva',
    });
    expect(adminInbox.body.items[0].body).toContain('Carla');
    expect((await pro.get('/api/notifications')).body.unreadCount).toBe(1);
    expect((await client.get('/api/notifications')).body.items[0].title).toBe('Reserva registrada');

    await admin
      .patch(`/api/admin/bookings/${created.body.booking.id}/status`)
      .send({ status: 'CONFIRMED' });
    const clientInbox = await client.get('/api/notifications').query({ unreadOnly: 'true' });
    expect(clientInbox.body.items.map((n: { type: string }) => n.type)).toEqual([
      'BOOKING_CONFIRMED',
      'BOOKING_CREATED',
    ]);
  });

  it('marks notifications as read, only for their owner', async () => {
    const owner = await createUser({ email: 'a@test.dev' });
    const other = await createUser({ email: 'b@test.dev' });
    const note = await prisma.notification.create({
      data: { userId: owner.id, type: 'BOOKING_CREATED', title: 'x', body: 'y' },
    });
    const stranger = await loginAs(other.email);
    expect((await stranger.post(`/api/notifications/${note.id}/read`)).status).toBe(404);

    const me = await loginAs(owner.email);
    expect((await me.post(`/api/notifications/${note.id}/read`)).status).toBe(204);
    expect((await me.get('/api/notifications')).body.unreadCount).toBe(0);

    await prisma.notification.create({
      data: { userId: owner.id, type: 'BOOKING_CANCELLED', title: 'x', body: 'y' },
    });
    await me.post('/api/notifications/read-all');
    expect((await me.get('/api/notifications')).body.unreadCount).toBe(0);
  });
});

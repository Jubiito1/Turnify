import type { BookingStatus } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './helpers/db';
import { createBusiness, createProfessional, createService, createUser } from './helpers/factories';
import { loginAs } from './helpers/http';
import { localTime, nextWeekday } from './helpers/time';

describe('booking queries, clients and CSV export (T14)', () => {
  let admin: Awaited<ReturnType<typeof loginAs>>;
  let client: Awaited<ReturnType<typeof loginAs>>;
  let businessId: string;
  let serviceId: string;
  let professionalId: string;
  let clientId: string;
  const day = nextWeekday(2);
  const nextDay = nextWeekday(3);

  beforeEach(async () => {
    await resetDb();
    const { business, owner } = await createBusiness();
    const service = await createService(business.id, { name: 'Corte', priceCents: 150050 });
    const { professional } = await createProfessional(business.id, [service.id], {
      displayName: 'Lucía',
    });
    businessId = business.id;
    serviceId = service.id;
    professionalId = professional.id;
    const user = await prisma.user.create({
      data: {
        email: 'juan@test.dev',
        name: 'Juan Pérez',
        phone: '+54 11 1111',
        passwordHash: (await createUser()).passwordHash,
      },
    });
    clientId = user.id;
    client = await loginAs('juan@test.dev');
    admin = await loginAs(owner.email);
  });

  async function seed(
    startsAt: string | Date,
    status: BookingStatus = 'CONFIRMED',
    overrides: Record<string, string> = {},
  ) {
    const start = new Date(startsAt);
    return prisma.booking.create({
      data: {
        businessId,
        serviceId,
        professionalId,
        clientId,
        startsAt: start,
        endsAt: new Date(start.getTime() + 30 * 60_000),
        priceCents: 150050,
        status,
        ...overrides,
      },
    });
  }

  describe('client list (RN-009)', () => {
    it('splits upcoming active bookings from history', async () => {
      const upcoming = await seed(localTime(day, '10:00'));
      await seed(localTime(day, '12:00'), 'CANCELLED');
      await seed(new Date(Date.now() - 48 * 3_600_000), 'COMPLETED');
      const other = await createUser();
      await seed(localTime(day, '15:00'), 'CONFIRMED', { clientId: other.id });

      const up = await client.get('/api/bookings').query({ scope: 'upcoming' });
      expect(up.body.items.map((b: { id: string }) => b.id)).toEqual([upcoming.id]);

      const past = await client.get('/api/bookings').query({ scope: 'past' });
      expect(past.body.total).toBe(2);
      expect(past.body.items.map((b: { status: string }) => b.status).sort()).toEqual([
        'CANCELLED',
        'COMPLETED',
      ]);
    });
  });

  describe('admin list and filters (RN-011)', () => {
    beforeEach(async () => {
      await seed(localTime(day, '10:00'), 'PENDING');
      await seed(localTime(day, '11:00'), 'CONFIRMED');
      await seed(localTime(nextDay, '10:00'), 'CANCELLED');
      const { business: other } = await createBusiness();
      const foreignService = await createService(other.id);
      const { professional: foreignPro } = await createProfessional(other.id, [foreignService.id]);
      const foreignClient = await createUser();
      await prisma.booking.create({
        data: {
          businessId: other.id,
          serviceId: foreignService.id,
          professionalId: foreignPro.id,
          clientId: foreignClient.id,
          startsAt: new Date(localTime(day, '10:00')),
          endsAt: new Date(localTime(day, '10:30')),
          priceCents: 1,
        },
      });
    });

    it('lists only own business bookings with pagination', async () => {
      const res = await admin.get('/api/admin/bookings').query({ pageSize: 2 });
      expect(res.body).toMatchObject({ total: 3, page: 1, pageSize: 2 });
      expect(res.body.items).toHaveLength(2);
    });

    it('filters by local date range, status, professional, service and client text', async () => {
      const byDay = await admin.get('/api/admin/bookings').query({ from: day, to: day });
      expect(byDay.body.total).toBe(2);

      const byStatus = await admin
        .get('/api/admin/bookings')
        .query({ status: 'PENDING,CANCELLED' });
      expect(byStatus.body.total).toBe(2);

      const byPro = await admin.get('/api/admin/bookings').query({ professionalId });
      expect(byPro.body.total).toBe(3);

      const byText = await admin.get('/api/admin/bookings').query({ q: 'pérez' });
      expect(byText.body.total).toBe(3);
      const noMatch = await admin.get('/api/admin/bookings').query({ q: 'zzz' });
      expect(noMatch.body.total).toBe(0);
    });

    it('returns a calendar range in chronological order', async () => {
      const res = await admin.get('/api/admin/bookings/calendar').query({ from: day, to: nextDay });
      expect(res.body.items.map((b: { startsAt: string }) => b.startsAt)).toEqual([
        localTime(day, '10:00'),
        localTime(day, '11:00'),
        localTime(nextDay, '10:00'),
      ]);
    });

    it('exports CSV with local times and exact amounts', async () => {
      const res = await admin.get('/api/admin/bookings/export.csv').query({ from: day, to: day });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="?reservas-/);
      const lines = res.text.replace('﻿', '').trim().split('\r\n');
      expect(lines[0]).toBe(
        'Fecha,Inicio,Fin,Servicio,Profesional,Cliente,Email,Teléfono,Estado,Precio,Notas',
      );
      expect(lines).toHaveLength(3);
      expect(lines[1]).toBe(
        `${day},10:00,10:30,Corte,Lucía,Juan Pérez,juan@test.dev,'+54 11 1111,Pendiente,1500.50,`,
      );
    });

    it('lists clients with per-business totals and search', async () => {
      await prisma.booking.updateMany({
        where: { businessId, status: 'CONFIRMED' },
        data: { status: 'COMPLETED' },
      });
      const res = await admin.get('/api/admin/clients');
      expect(res.body.items).toEqual([
        expect.objectContaining({ name: 'Juan Pérez', totalBookings: 3, completedBookings: 1 }),
      ]);
      expect((await admin.get('/api/admin/clients').query({ q: 'nadie' })).body.total).toBe(0);
    });

    it('hides bookings of other businesses in the detail endpoint (RN-021, RN-025)', async () => {
      const foreign = await prisma.booking.findFirstOrThrow({ where: { NOT: { businessId } } });
      expect((await admin.get(`/api/admin/bookings/${foreign.id}`)).status).toBe(404);
    });
  });

  describe('professional agenda (RN-010)', () => {
    it("returns only the professional's own bookings and profile", async () => {
      const { user, professional } = await createProfessional(businessId, [serviceId], {
        withAccount: true,
        displayName: 'Martín',
      });
      const pro = await loginAs(user!.email);
      await seed(localTime(day, '10:00'));
      const own = await seed(localTime(day, '11:00'), 'CONFIRMED', {
        professionalId: professional.id,
        clientId: (await createUser()).id,
      });

      const res = await pro.get('/api/pro/bookings').query({ from: day, to: day });
      expect(res.body.items.map((b: { id: string }) => b.id)).toEqual([own.id]);

      const me = await pro.get('/api/pro/me');
      expect(me.body.professional).toMatchObject({
        displayName: 'Martín',
        business: { id: businessId },
      });
    });

    it('rejects deactivated professionals', async () => {
      const { user, professional } = await createProfessional(businessId, [serviceId], {
        withAccount: true,
      });
      await prisma.professional.update({
        where: { id: professional.id },
        data: { isActive: false },
      });
      const pro = await loginAs(user!.email);
      expect((await pro.get('/api/pro/bookings')).status).toBe(403);
    });
  });
});

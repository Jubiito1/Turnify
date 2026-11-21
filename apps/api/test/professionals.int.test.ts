import { beforeEach, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './helpers/db';
import { createBusiness, createProfessional, createService, createUser } from './helpers/factories';
import { app, loginAs, request } from './helpers/http';

describe('admin professionals (T09)', () => {
  let admin: Awaited<ReturnType<typeof loginAs>>;
  let businessId: string;
  let slug: string;

  beforeEach(async () => {
    await resetDb();
    const { business, owner } = await createBusiness();
    businessId = business.id;
    slug = business.slug;
    admin = await loginAs(owner.email);
  });

  it('creates a professional with a login account and default permissions', async () => {
    const res = await admin.post('/api/admin/professionals').send({
      displayName: 'Lucía Pérez',
      bio: 'Colorista',
      account: { email: 'Lucia@Test.dev', password: 'turnify2026' },
    });
    expect(res.status).toBe(201);
    expect(res.body.professional).toMatchObject({
      displayName: 'Lucía Pérez',
      isActive: true,
      canManageBlocks: false,
      canCompleteBookings: true,
      account: { email: 'lucia@test.dev' },
      serviceIds: [],
      workingHours: [],
    });

    const pro = await loginAs('lucia@test.dev', 'turnify2026');
    const me = await pro.get('/api/auth/me');
    expect(me.body.user).toMatchObject({
      role: 'PROFESSIONAL',
      professionalId: res.body.professional.id,
    });
  });

  it('rejects an account email that is already registered', async () => {
    await createUser({ email: 'taken@test.dev' });
    const res = await admin.post('/api/admin/professionals').send({
      displayName: 'Otro',
      account: { email: 'taken@test.dev', password: 'turnify2026' },
    });
    expect(res.status).toBe(409);
    expect(await prisma.professional.count()).toBe(0);
  });

  it('assigns services of the same business only (RN-003, RN-025)', async () => {
    const { professional } = await createProfessional(businessId, []);
    const own = await createService(businessId);
    const { business: other } = await createBusiness();
    const foreign = await createService(other.id);

    const ok = await admin
      .put(`/api/admin/professionals/${professional.id}/services`)
      .send({ serviceIds: [own.id] });
    expect(ok.status).toBe(200);
    expect(ok.body.professional.serviceIds).toEqual([own.id]);

    const bad = await admin
      .put(`/api/admin/professionals/${professional.id}/services`)
      .send({ serviceIds: [own.id, foreign.id] });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('INVALID_SERVICE_ASSIGNMENT');
    // Unchanged after the rejected request
    const current = await admin.get(`/api/admin/professionals/${professional.id}`);
    expect(current.body.professional.serviceIds).toEqual([own.id]);
  });

  it('replaces working hours and rejects overlapping ranges (RN-030)', async () => {
    const { professional } = await createProfessional(businessId, []);
    const hours = [
      { weekday: 1, startMinute: 540, endMinute: 780 },
      { weekday: 1, startMinute: 840, endMinute: 1080 },
      { weekday: 3, startMinute: 600, endMinute: 900 },
    ];
    const ok = await admin
      .put(`/api/admin/professionals/${professional.id}/working-hours`)
      .send({ hours });
    expect(ok.status).toBe(200);
    expect(ok.body.professional.workingHours).toEqual(hours);

    const bad = await admin.put(`/api/admin/professionals/${professional.id}/working-hours`).send({
      hours: [
        { weekday: 2, startMinute: 540, endMinute: 780 },
        { weekday: 2, startMinute: 700, endMinute: 900 },
      ],
    });
    expect(bad.status).toBe(400);
    expect(await prisma.workingHours.count({ where: { professionalId: professional.id } })).toBe(3);
  });

  it('deactivates without deleting history and hides from the catalog (RN-023)', async () => {
    const service = await createService(businessId);
    const { professional } = await createProfessional(businessId, [service.id]);
    const client = await createUser();
    await prisma.booking.create({
      data: {
        businessId,
        serviceId: service.id,
        professionalId: professional.id,
        clientId: client.id,
        startsAt: new Date('2025-01-07T13:00:00Z'),
        endsAt: new Date('2025-01-07T13:30:00Z'),
        priceCents: 1000,
        status: 'COMPLETED',
      },
    });

    const res = await admin
      .patch(`/api/admin/professionals/${professional.id}`)
      .send({ isActive: false });
    expect(res.body.professional).toMatchObject({ isActive: false, canCompleteBookings: true });

    expect(await prisma.booking.count({ where: { professionalId: professional.id } })).toBe(1);
    const page = await request(app).get(`/api/businesses/${slug}`);
    expect(page.body.professionals).toHaveLength(0);
  });

  it('updates permissions without touching other fields (RN-033)', async () => {
    const { professional } = await createProfessional(businessId, [], { displayName: 'Ana' });
    const res = await admin
      .patch(`/api/admin/professionals/${professional.id}`)
      .send({ canManageBlocks: true });
    expect(res.body.professional).toMatchObject({
      displayName: 'Ana',
      canManageBlocks: true,
      isActive: true,
    });
  });

  it('isolates professionals between businesses (RN-011, RN-021)', async () => {
    const { business: other } = await createBusiness();
    const { professional: foreign } = await createProfessional(other.id, []);

    expect((await admin.get(`/api/admin/professionals/${foreign.id}`)).status).toBe(404);
    expect(
      (await admin.patch(`/api/admin/professionals/${foreign.id}`).send({ isActive: false }))
        .status,
    ).toBe(404);
    expect(
      (await admin.put(`/api/admin/professionals/${foreign.id}/working-hours`).send({ hours: [] }))
        .status,
    ).toBe(404);
    expect((await admin.get('/api/admin/professionals')).body.items).toHaveLength(0);
  });

  it('exposes active professionals with their services on the public page', async () => {
    const service = await createService(businessId);
    await createProfessional(businessId, [service.id], { displayName: 'Visible' });
    const page = await request(app).get(`/api/businesses/${slug}`);
    expect(page.body.professionals).toEqual([
      expect.objectContaining({ displayName: 'Visible', serviceIds: [service.id] }),
    ]);
    expect(page.body.professionals[0]).not.toHaveProperty('canManageBlocks');
  });
});

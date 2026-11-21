import { beforeEach, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './helpers/db';
import { createBusiness, createProfessional, createService, createUser } from './helpers/factories';
import { app, loginAs, request } from './helpers/http';

describe('admin services (T08)', () => {
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

  it('creates, lists and updates services with integer cents (RN-018)', async () => {
    const created = await admin.post('/api/admin/services').send({
      name: 'Corte',
      description: 'Corte clásico',
      durationMinutes: 45,
      priceCents: 1850050,
    });
    expect(created.status).toBe(201);
    expect(created.body.service).toMatchObject({
      name: 'Corte',
      priceCents: 1850050,
      isActive: true,
    });

    const id = created.body.service.id as string;
    const updated = await admin.patch(`/api/admin/services/${id}`).send({ priceCents: 2000000 });
    expect(updated.status).toBe(200);
    expect(updated.body.service).toMatchObject({
      priceCents: 2000000,
      name: 'Corte',
      durationMinutes: 45,
    });

    const list = await admin.get('/api/admin/services');
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ id, professionalCount: 0 });
  });

  it('rejects non-integer, negative prices and invalid durations', async () => {
    const res = await admin
      .post('/api/admin/services')
      .send({ name: 'Mal', durationMinutes: 33, priceCents: 10.5 });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['durationMinutes', 'priceCents']));
  });

  it('deactivation hides the service from the catalog and partial updates keep it inactive (RN-017)', async () => {
    const service = await createService(businessId, { name: 'Color' });
    await admin.patch(`/api/admin/services/${service.id}`).send({ isActive: false });

    const renamed = await admin
      .patch(`/api/admin/services/${service.id}`)
      .send({ name: 'Color total' });
    expect(renamed.body.service).toMatchObject({ name: 'Color total', isActive: false });

    const page = await request(app).get(`/api/businesses/${slug}`);
    expect(page.body.services).toHaveLength(0);
  });

  it('deletes unused services but protects services with bookings', async () => {
    const unused = await createService(businessId);
    expect((await admin.delete(`/api/admin/services/${unused.id}`)).status).toBe(204);

    const used = await createService(businessId);
    const { professional } = await createProfessional(businessId, [used.id]);
    const client = await createUser();
    await prisma.booking.create({
      data: {
        businessId,
        serviceId: used.id,
        professionalId: professional.id,
        clientId: client.id,
        startsAt: new Date('2030-01-07T13:00:00Z'),
        endsAt: new Date('2030-01-07T13:30:00Z'),
        priceCents: used.priceCents,
      },
    });
    const res = await admin.delete(`/api/admin/services/${used.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SERVICE_HAS_BOOKINGS');
  });

  it("cannot read or modify another business' services (RN-011, RN-021, RN-025)", async () => {
    const { business: other } = await createBusiness();
    const foreign = await createService(other.id, { name: 'Ajeno' });

    expect(
      (await admin.patch(`/api/admin/services/${foreign.id}`).send({ name: 'Xx' })).status,
    ).toBe(404);
    expect((await admin.delete(`/api/admin/services/${foreign.id}`)).status).toBe(404);
    const list = await admin.get('/api/admin/services');
    expect(list.body.items).toHaveLength(0);
    expect((await prisma.service.findUniqueOrThrow({ where: { id: foreign.id } })).name).toBe(
      'Ajeno',
    );
  });

  it('answers 404 for malformed ids and 403 for non-admin roles (RN-024)', async () => {
    expect((await admin.patch('/api/admin/services/not-a-uuid').send({ name: 'Xx' })).status).toBe(
      404,
    );

    await createUser({ email: 'client@test.dev' });
    const client = await loginAs('client@test.dev');
    expect((await client.get('/api/admin/services')).status).toBe(403);
  });
});

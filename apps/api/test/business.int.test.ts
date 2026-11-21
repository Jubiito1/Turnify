import { beforeEach, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './helpers/db';
import { createBusiness, createService, createUser } from './helpers/factories';
import { app, loginAs, request } from './helpers/http';

const onboarding = {
  name: 'Marta Díaz',
  email: 'marta@test.dev',
  password: 'turnify2026',
  businessName: 'Peluquería Ñandú',
  category: 'BEAUTY',
  timezone: 'America/Argentina/Buenos_Aires',
};

const settings = {
  name: 'Peluquería Ñandú',
  description: 'Cortes y color',
  category: 'BEAUTY',
  timezone: 'America/Argentina/Cordoba',
  address: 'Calle 123',
  phone: '+54 11 5555-5555',
  cancellationMinHours: 6,
  slotIntervalMinutes: 30,
  bookingHorizonDays: 30,
  autoConfirm: true,
};

describe('business onboarding and settings', () => {
  beforeEach(() => resetDb());

  it('registers an admin together with its business', async () => {
    const res = await request(app).post('/api/auth/register-business').send(onboarding);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ role: 'ADMIN', email: 'marta@test.dev' });
    expect(res.body.business).toMatchObject({
      name: 'Peluquería Ñandú',
      slug: 'peluqueria-nandu',
      cancellationMinHours: 24,
      slotIntervalMinutes: 15,
    });
    expect(res.body.user.businessId).toBe(res.body.business.id);
  });

  it('generates a unique slug for repeated business names', async () => {
    await request(app).post('/api/auth/register-business').send(onboarding);
    const res = await request(app)
      .post('/api/auth/register-business')
      .send({ ...onboarding, email: 'otra@test.dev' });
    expect(res.body.business.slug).toBe('peluqueria-nandu-2');
  });

  it('rejects an invalid time zone and a taken email', async () => {
    const badTz = await request(app)
      .post('/api/auth/register-business')
      .send({ ...onboarding, timezone: 'Mars/Base' });
    expect(badTz.status).toBe(400);

    await createUser({ email: 'marta@test.dev' });
    const taken = await request(app).post('/api/auth/register-business').send(onboarding);
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe('EMAIL_TAKEN');
    expect(await prisma.business.count()).toBe(0);
  });

  it('lets the admin read and update its own settings (RN-011, RN-013)', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register-business').send(onboarding);

    const update = await agent.put('/api/admin/business').send(settings);
    expect(update.status).toBe(200);
    expect(update.body.business).toMatchObject({
      cancellationMinHours: 6,
      timezone: 'America/Argentina/Cordoba',
      autoConfirm: true,
    });

    const read = await agent.get('/api/admin/business');
    expect(read.body.business.slotIntervalMinutes).toBe(30);
  });

  it('validates settings ranges', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register-business').send(onboarding);
    const res = await agent
      .put('/api/admin/business')
      .send({ ...settings, cancellationMinHours: 500, slotIntervalMinutes: 7 });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['cancellationMinHours', 'slotIntervalMinutes']),
    );
  });

  it('enforces admin authorization in the backend (RN-024)', async () => {
    expect((await request(app).get('/api/admin/business')).status).toBe(401);

    await createUser({ email: 'client@test.dev' });
    const client = await loginAs('client@test.dev');
    const res = await client.put('/api/admin/business').send(settings);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('public catalog', () => {
  beforeEach(() => resetDb());

  it('lists active businesses with search, category filter and pagination', async () => {
    const { business: a } = await createBusiness({ name: 'Barbería Norte' });
    await prisma.business.update({ where: { id: a.id }, data: { category: 'BARBERSHOP' } });
    await createService(a.id, { priceCents: 500000 });
    await createService(a.id, { priceCents: 300000 });
    await createService(a.id, { priceCents: 100, isActive: false });
    await createBusiness({ name: 'Spa Sur' });
    const { business: hidden } = await createBusiness({ name: 'Barbería Cerrada' });
    await prisma.business.update({ where: { id: hidden.id }, data: { isActive: false } });

    const all = await request(app).get('/api/businesses');
    expect(all.body.total).toBe(2);

    const search = await request(app).get('/api/businesses').query({ q: 'barbería' });
    expect(search.body.items).toHaveLength(1);
    expect(search.body.items[0]).toMatchObject({
      name: 'Barbería Norte',
      serviceCount: 2,
      minPriceCents: 300000,
    });

    const byCategory = await request(app).get('/api/businesses').query({ category: 'BARBERSHOP' });
    expect(byCategory.body.items.map((b: { name: string }) => b.name)).toEqual(['Barbería Norte']);

    const paged = await request(app).get('/api/businesses').query({ page: 2, pageSize: 1 });
    expect(paged.body).toMatchObject({ total: 2, page: 2, pageSize: 1 });
    expect(paged.body.items[0].name).toBe('Spa Sur');
  });

  it('shows a business page with only its active services (RN-017, RN-025)', async () => {
    const { business } = await createBusiness({ name: 'Mi Negocio' });
    await createService(business.id, { name: 'Activo' });
    await createService(business.id, { name: 'Inactivo', isActive: false });
    const { business: other } = await createBusiness({ name: 'Otro' });
    await createService(other.id, { name: 'Ajeno' });

    const res = await request(app).get(`/api/businesses/${business.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.business.name).toBe('Mi Negocio');
    expect(res.body.services.map((s: { name: string }) => s.name)).toEqual(['Activo']);
  });

  it('returns 404 for unknown or inactive businesses', async () => {
    expect((await request(app).get('/api/businesses/no-existe')).status).toBe(404);
  });

  it('rejects invalid query parameters', async () => {
    const res = await request(app).get('/api/businesses').query({ category: 'SPACESHIP' });
    expect(res.status).toBe(400);
  });
});

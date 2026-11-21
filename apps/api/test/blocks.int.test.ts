import { beforeEach, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './helpers/db';
import { createBusiness, createProfessional, createService, createUser } from './helpers/factories';
import { loginAs } from './helpers/http';
import { localTime, nextWeekday } from './helpers/time';

describe('availability blocks (T11)', () => {
  let admin: Awaited<ReturnType<typeof loginAs>>;
  let businessId: string;
  let serviceId: string;
  let professionalId: string;
  const day = nextWeekday(2);
  const block = (from: string, to: string, extra: Record<string, unknown> = {}) => ({
    professionalId,
    startsAt: localTime(day, from),
    endsAt: localTime(day, to),
    reason: 'Turno médico',
    ...extra,
  });

  beforeEach(async () => {
    await resetDb();
    const { business, owner } = await createBusiness();
    const service = await createService(business.id);
    const { professional } = await createProfessional(business.id, [service.id]);
    businessId = business.id;
    serviceId = service.id;
    professionalId = professional.id;
    admin = await loginAs(owner.email);
  });

  async function addBooking(from: string, status: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED') {
    const client = await createUser();
    const startsAt = new Date(localTime(day, from));
    return prisma.booking.create({
      data: {
        businessId,
        serviceId,
        professionalId,
        clientId: client.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 30 * 60_000),
        priceCents: 1000,
        status,
      },
    });
  }

  it('lets the admin create, list and delete blocks', async () => {
    const created = await admin.post('/api/admin/blocks').send(block('12:00', '14:00'));
    expect(created.status).toBe(201);
    expect(created.body.block).toMatchObject({
      professionalId,
      professionalName: 'Pro',
      reason: 'Turno médico',
    });

    const list = await admin.get('/api/admin/blocks');
    expect(list.body.items).toHaveLength(1);

    expect((await admin.delete(`/api/admin/blocks/${created.body.block.id}`)).status).toBe(204);
    expect((await admin.get('/api/admin/blocks')).body.items).toHaveLength(0);
  });

  it('rejects blocks overlapping active bookings, ignoring cancelled ones (RN-029)', async () => {
    await addBooking('12:30');
    await addBooking('16:00', 'CANCELLED');

    const res = await admin.post('/api/admin/blocks').send(block('12:00', '14:00'));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'BLOCK_CONFLICTS_WITH_BOOKINGS',
      details: { conflictingBookings: 1 },
    });

    expect((await admin.post('/api/admin/blocks').send(block('15:30', '17:00'))).status).toBe(201);
  });

  it('rejects blocks that already ended and inverted ranges', async () => {
    const past = await admin.post('/api/admin/blocks').send({
      professionalId,
      startsAt: '2020-01-01T10:00:00Z',
      endsAt: '2020-01-01T11:00:00Z',
    });
    expect(past.status).toBe(422);
    expect(past.body.error.code).toBe('BLOCK_IN_PAST');
    expect((await admin.post('/api/admin/blocks').send(block('14:00', '12:00'))).status).toBe(400);
  });

  it("cannot block or delete another business' professionals (RN-011, RN-025)", async () => {
    const { business: other } = await createBusiness();
    const { professional: foreign } = await createProfessional(other.id, []);
    const res = await admin
      .post('/api/admin/blocks')
      .send(block('12:00', '13:00', { professionalId: foreign.id }));
    expect(res.status).toBe(404);

    const foreignBlock = await prisma.timeBlock.create({
      data: {
        professionalId: foreign.id,
        startsAt: new Date(localTime(day, '09:00')),
        endsAt: new Date(localTime(day, '10:00')),
      },
    });
    expect((await admin.delete(`/api/admin/blocks/${foreignBlock.id}`)).status).toBe(404);
  });

  describe('professional panel (RN-033)', () => {
    it('allows an authorized professional to block only its own agenda', async () => {
      const service = await createService(businessId);
      const { user } = await createProfessional(businessId, [service.id], {
        withAccount: true,
        canManageBlocks: true,
      });
      const pro = await loginAs(user!.email);
      const me = await prisma.professional.findUniqueOrThrow({ where: { userId: user!.id } });

      // Tries to target another professional: the id is forced to its own profile.
      const res = await pro.post('/api/pro/blocks').send(block('10:00', '11:00'));
      expect(res.status).toBe(201);
      expect(res.body.block.professionalId).toBe(me.id);

      const list = await pro.get('/api/pro/blocks');
      expect(list.body.items.map((b: { id: string }) => b.id)).toEqual([res.body.block.id]);
    });

    it('rejects professionals without the permission', async () => {
      const { user } = await createProfessional(businessId, [], { withAccount: true });
      const pro = await loginAs(user!.email);
      const res = await pro.post('/api/pro/blocks').send(block('10:00', '11:00'));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PERMISSION_DENIED');
    });

    it("cannot delete other professionals' blocks", async () => {
      const { user } = await createProfessional(businessId, [], {
        withAccount: true,
        canManageBlocks: true,
      });
      const pro = await loginAs(user!.email);
      const othersBlock = await prisma.timeBlock.create({
        data: {
          professionalId,
          startsAt: new Date(localTime(day, '09:00')),
          endsAt: new Date(localTime(day, '10:00')),
        },
      });
      expect((await pro.delete(`/api/pro/blocks/${othersBlock.id}`)).status).toBe(404);
    });

    it('rejects clients and admins on professional routes (RN-024)', async () => {
      expect((await admin.get('/api/pro/blocks')).status).toBe(403);
      await createUser({ email: 'client@test.dev' });
      expect((await (await loginAs('client@test.dev')).get('/api/pro/blocks')).status).toBe(403);
    });
  });
});

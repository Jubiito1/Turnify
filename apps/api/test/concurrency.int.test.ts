import { beforeEach, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './helpers/db';
import { createBusiness, createProfessional, createService, createUser } from './helpers/factories';
import { loginAs } from './helpers/http';
import { localTime, nextWeekday } from './helpers/time';

/**
 * RN-020: N simultaneous HTTP requests for the same slot must produce exactly one booking.
 * Runs against a real PostgreSQL; no mocks.
 */
describe('concurrent booking requests', () => {
  const day = nextWeekday(4);
  let serviceId: string;
  let professionalId: string;

  beforeEach(async () => {
    await resetDb();
    const { business } = await createBusiness();
    const service = await createService(business.id, { durationMinutes: 60 });
    const { professional } = await createProfessional(business.id, [service.id]);
    serviceId = service.id;
    professionalId = professional.id;
  });

  it('accepts exactly one of 10 simultaneous requests for the same slot', async () => {
    const agents = await Promise.all(
      Array.from({ length: 10 }, async (_, i) => {
        await createUser({ email: `racer${i}@test.dev` });
        return loginAs(`racer${i}@test.dev`);
      }),
    );

    const responses = await Promise.all(
      agents.map((agent) =>
        agent.post('/api/bookings').send({
          serviceId,
          professionalId,
          startsAt: localTime(day, '11:00'),
        }),
      ),
    );

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
    expect(
      responses.filter((r) => r.status === 409).every((r) => r.body.error.code === 'SLOT_TAKEN'),
    ).toBe(true);
    expect(await prisma.booking.count({ where: { professionalId } })).toBe(1);
  });

  it('accepts exactly one of several overlapping (not identical) requests', async () => {
    const starts = ['10:00', '10:15', '10:30', '10:45'];
    const agents = await Promise.all(
      starts.map(async (_, i) => {
        await createUser({ email: `overlap${i}@test.dev` });
        return loginAs(`overlap${i}@test.dev`);
      }),
    );
    const responses = await Promise.all(
      agents.map((agent, i) =>
        agent
          .post('/api/bookings')
          .send({ serviceId, professionalId, startsAt: localTime(day, starts[i]!) }),
      ),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await prisma.booking.count({ where: { professionalId } })).toBe(1);
  });
});

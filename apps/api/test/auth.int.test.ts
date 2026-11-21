import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma, resetDb } from './helpers/db';
import { createUser, TEST_PASSWORD } from './helpers/factories';
import { app, loginAs, request } from './helpers/http';

const newUser = { name: 'Ana Gómez', email: 'ana@test.dev', password: 'turnify2026' };

function sessionCookie(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith('turnify_session='));
}

describe('auth', () => {
  beforeEach(() => resetDb());

  describe('POST /api/auth/register', () => {
    it('creates a client, stores only a bcrypt hash and opens a session (RN-031)', async () => {
      const res = await request(app).post('/api/auth/register').send(newUser);

      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({
        email: 'ana@test.dev',
        role: 'CLIENT',
        name: 'Ana Gómez',
      });
      expect(res.body.user).not.toHaveProperty('passwordHash');

      const cookie = sessionCookie(res);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);

      const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'ana@test.dev' } });
      expect(stored.passwordHash).not.toBe(newUser.password);
      expect(await bcrypt.compare(newUser.password, stored.passwordHash!)).toBe(true);
    });

    it('rejects a duplicated email regardless of case (RN-031)', async () => {
      await request(app).post('/api/auth/register').send(newUser);
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...newUser, email: 'ANA@test.dev' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });

    it('rejects weak passwords with field details', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...newUser, password: 'abc' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details[0].path).toBe('password');
    });

    it('lets a guest client created by a business claim the account', async () => {
      await prisma.user.create({ data: { email: 'ana@test.dev', name: 'Ana', role: 'CLIENT' } });
      const res = await request(app).post('/api/auth/register').send(newUser);
      expect(res.status).toBe(201);
      expect(await prisma.user.count({ where: { email: 'ana@test.dev' } })).toBe(1);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      const user = await createUser({ email: 'login@test.dev' });
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'LOGIN@test.dev', password: TEST_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(user.id);
      expect(sessionCookie(res)).toBeDefined();
    });

    it('returns the same error for a wrong password and an unknown email', async () => {
      await createUser({ email: 'login@test.dev' });
      const wrong = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@test.dev', password: 'wrong-pass1' });
      const unknown = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@test.dev', password: 'wrong-pass1' });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body).toEqual(unknown.body);
      expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('does not allow guest clients without password to log in', async () => {
      await prisma.user.create({ data: { email: 'guest@test.dev', name: 'Guest' } });
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'guest@test.dev', password: 'anything1' });
      expect(res.status).toBe(401);
    });

    it('limits repeated attempts per IP (RN-032)', async () => {
      const limitedApp = createApp({ authRateLimitMax: 3 });
      const attempt = () =>
        request(limitedApp)
          .post('/api/auth/login')
          .send({ email: 'x@test.dev', password: 'wrong-pass1' });
      for (let i = 0; i < 3; i++) expect((await attempt()).status).toBe(401);
      const blocked = await attempt();
      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
    });
  });

  describe('session', () => {
    it('GET /api/auth/me requires a session (RN-024)', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('GET /api/auth/session answers 200 with the user or null', async () => {
      expect((await request(app).get('/api/auth/session')).body).toEqual({ user: null });
      await createUser({ email: 'probe@test.dev' });
      const agent = await loginAs('probe@test.dev');
      const res = await agent.get('/api/auth/session');
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('probe@test.dev');
    });

    it('rejects a tampered session token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'turnify_session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.invalid');
      expect(res.status).toBe(401);
    });

    it('returns the current user and clears the session on logout', async () => {
      const user = await createUser({ email: 'me@test.dev' });
      const agent = await loginAs('me@test.dev');

      const me = await agent.get('/api/auth/me');
      expect(me.status).toBe(200);
      expect(me.body.user).toMatchObject({ id: user.id, businessId: null, professionalId: null });

      const logout = await agent.post('/api/auth/logout');
      expect(logout.status).toBe(204);
      expect((await agent.get('/api/auth/me')).status).toBe(401);
    });
  });

  describe('profile', () => {
    it('updates name and phone', async () => {
      await createUser({ email: 'me@test.dev' });
      const agent = await loginAs('me@test.dev');
      const res = await agent
        .patch('/api/auth/me')
        .send({ name: 'Nuevo Nombre', phone: '+54 11 1234' });
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ name: 'Nuevo Nombre', phone: '+54 11 1234' });
    });

    it('changes the password only with the current password', async () => {
      await createUser({ email: 'me@test.dev' });
      const agent = await loginAs('me@test.dev');

      const wrong = await agent
        .post('/api/auth/me/password')
        .send({ currentPassword: 'nope', newPassword: 'another123' });
      expect(wrong.status).toBe(400);
      expect(wrong.body.error.code).toBe('INVALID_CURRENT_PASSWORD');

      const ok = await agent
        .post('/api/auth/me/password')
        .send({ currentPassword: TEST_PASSWORD, newPassword: 'another123' });
      expect(ok.status).toBe(204);
      await expect(loginAs('me@test.dev', 'another123')).resolves.toBeDefined();
    });
  });
});

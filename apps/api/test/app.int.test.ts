import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

const app = createApp();

describe('API skeleton', () => {
  it('GET /api/health responds ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'turnify-api', database: 'ok' });
  });

  it('unknown routes return the standard error shape', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  it('malformed JSON bodies return 400 INVALID_BODY', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_BODY');
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('allows configured CORS origins with credentials', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not grant CORS to unknown origins', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  describe('origin guard (CSRF defense in depth)', () => {
    const guarded = createApp({ enforceOrigin: true });

    it('rejects state-changing requests from foreign origins', async () => {
      const res = await request(guarded)
        .post('/api/auth/logout')
        .set('Origin', 'https://evil.example');
      expect(res.status).toBe(403);
    });

    it('allows configured origins, same-host origins and requests without Origin', async () => {
      expect(
        (await request(guarded).post('/api/auth/logout').set('Origin', 'http://localhost:5173'))
          .status,
      ).toBe(204);
      expect((await request(guarded).post('/api/auth/logout')).status).toBe(204);
      expect(
        (await request(guarded).get('/api/health').set('Origin', 'https://evil.example')).status,
      ).toBe(200);
    });
  });
});

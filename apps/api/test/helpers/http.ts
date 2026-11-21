import request from 'supertest';
import { createApp } from '../../src/app';
import { TEST_PASSWORD } from './factories';

export const app = createApp();

/** Returns a supertest agent holding the session cookie of the given user. */
export async function loginAs(email: string, password = TEST_PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}

export { request };

import type { SessionUser } from '@turnify/shared';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/** API mock for component tests (network level, the real fetch client is exercised). */
export const server = setupServer(
  // Default: anonymous visitor.
  http.get('*/api/auth/me', () =>
    HttpResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Necesitas iniciar sesión' } },
      { status: 401 },
    ),
  ),
);

export function apiError(status: number, code: string, message: string, details?: unknown) {
  return HttpResponse.json({ error: { code, message, details } }, { status });
}

export const demoUsers: Record<'client' | 'admin' | 'pro', SessionUser> = {
  client: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Juan Pérez',
    email: 'cliente@turnify.demo',
    phone: null,
    role: 'CLIENT',
    businessId: null,
    professionalId: null,
  },
  admin: {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Valeria Sosa',
    email: 'admin@turnify.demo',
    phone: null,
    role: 'ADMIN',
    businessId: '33333333-3333-4333-8333-333333333333',
    professionalId: null,
  },
  pro: {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Lucía Fernández',
    email: 'pro@turnify.demo',
    phone: null,
    role: 'PROFESSIONAL',
    businessId: null,
    professionalId: '55555555-5555-4555-8555-555555555555',
  },
};

/** Handler that makes GET /auth/me return the given user. */
export function signedInAs(user: SessionUser) {
  return http.get('*/api/auth/me', () => HttpResponse.json({ user }));
}

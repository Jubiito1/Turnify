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
  // Default: empty public catalog (landing page).
  http.get('*/api/businesses', () =>
    HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 6 }),
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

/** Minimal admin panel API (business, empty stats, no pending bookings). */
export function adminPanelHandlers() {
  return [
    http.get('*/api/admin/business', () =>
      HttpResponse.json({
        business: {
          id: 'b',
          name: 'Estudio Lumen',
          slug: 'estudio-lumen',
          timezone: 'America/Argentina/Buenos_Aires',
        },
      }),
    ),
    http.get('*/api/admin/stats', () =>
      HttpResponse.json({
        stats: {
          range: { from: '2030-01-01', to: '2030-01-07' },
          totals: {
            bookings: 0,
            active: 0,
            completed: 0,
            cancelled: 0,
            noShow: 0,
            revenueCents: 0,
            expectedRevenueCents: 0,
            uniqueClients: 0,
            cancellationRate: 0,
            occupancyRate: 0,
          },
          byService: [],
          byProfessional: [],
          byDay: [],
        },
      }),
    ),
    http.get('*/api/admin/bookings', () =>
      HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 5 }),
    ),
  ];
}

/** Handler that makes GET /auth/me return the given user. */
export function signedInAs(user: SessionUser) {
  return http.get('*/api/auth/me', () => HttpResponse.json({ user }));
}

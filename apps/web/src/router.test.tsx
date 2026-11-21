import { screen } from '@testing-library/react';
import { renderApp } from './test/render';
import { demoUsers, server, signedInAs } from './test/server';
import { http, HttpResponse } from 'msw';

describe('app routing', () => {
  it('renders the landing page at /', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      /turnos sin vueltas/i,
    );
    expect(await screen.findByRole('link', { name: /^ingresar$/i })).toHaveAttribute(
      'href',
      '/ingresar',
    );
  });

  it('renders a 404 page for unknown routes', async () => {
    renderApp('/this/does/not/exist');
    expect(
      await screen.findByRole('heading', { name: /no encontramos esta página/i }),
    ).toBeInTheDocument();
  });

  it('redirects anonymous visitors of protected panels to the login page', async () => {
    const { router } = renderApp('/admin');
    expect(await screen.findByRole('heading', { name: /hola de nuevo/i })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ingresar');
    expect(router.state.location.search).toBe('?next=%2Fadmin');
  });

  it('sends users with another role to their own home', async () => {
    server.use(
      signedInAs(demoUsers.pro),
      http.get('*/api/pro/me', () =>
        HttpResponse.json({
          professional: {
            id: demoUsers.pro.professionalId,
            displayName: 'Lucía Fernández',
            bio: null,
            canManageBlocks: true,
            canCompleteBookings: true,
            business: {
              id: 'b',
              name: 'Estudio Lumen',
              slug: 'estudio-lumen',
              timezone: 'America/Argentina/Buenos_Aires',
            },
            workingHours: [],
          },
        }),
      ),
    );
    const { router } = renderApp('/admin');
    expect(await screen.findByRole('heading', { name: /hola, lucía/i })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/pro');
  });
});

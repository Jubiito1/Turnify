import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import {
  availability,
  booking,
  business,
  businessSummary,
  professionals,
  services,
} from '../../test/fixtures';
import { renderApp } from '../../test/render';
import { apiError, demoUsers, server, signedInAs } from '../../test/server';

function mockCatalog() {
  server.use(
    http.get('*/api/businesses', () =>
      HttpResponse.json({ items: [businessSummary], total: 1, page: 1, pageSize: 9 }),
    ),
    http.get('*/api/businesses/estudio-lumen', () =>
      HttpResponse.json({ business, services, professionals }),
    ),
    http.get('*/api/businesses/estudio-lumen/availability/summary', () =>
      HttpResponse.json({
        timezone: business.timezone,
        serviceId: services[0]!.id,
        days: [
          { date: '2030-01-06', slotCount: 0 },
          { date: '2030-01-07', slotCount: 3 },
        ],
      }),
    ),
    http.get('*/api/businesses/estudio-lumen/availability', () => HttpResponse.json(availability)),
  );
}

describe('catalog', () => {
  it('lists businesses and filters by text through the URL', async () => {
    let lastQuery = '';
    server.use(
      http.get('*/api/businesses', ({ request }) => {
        lastQuery = new URL(request.url).search;
        return HttpResponse.json({ items: [businessSummary], total: 1, page: 1, pageSize: 9 });
      }),
    );
    const { user, router } = renderApp('/explorar');
    expect(await screen.findByRole('heading', { name: 'Estudio Lumen' })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/buscar por nombre/i), 'lumen');
    await waitFor(() => expect(router.state.location.search).toBe('?q=lumen'));
    await waitFor(() => expect(lastQuery).toContain('q=lumen'));
  });

  it('shows the business page with services, prices and team', async () => {
    mockCatalog();
    renderApp('/negocios/estudio-lumen');
    expect(
      await screen.findByRole('heading', { name: 'Estudio Lumen', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Corte y peinado')).toBeInTheDocument();
    expect(screen.getByText(/18\.000/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reservar Corte y peinado' })).toHaveAttribute(
      'href',
      `/negocios/estudio-lumen/reservar?servicio=${services[0]!.id}`,
    );
    expect(screen.getByText('Martín Paz')).toBeInTheDocument();
  });

  it('renders a 404 for unknown businesses', async () => {
    server.use(
      http.get('*/api/businesses/nope', () => apiError(404, 'NOT_FOUND', 'Negocio no encontrado')),
    );
    renderApp('/negocios/nope');
    expect(
      await screen.findByRole('heading', { name: /no encontramos esta página/i }),
    ).toBeInTheDocument();
  });
});

describe('booking wizard', () => {
  it('books a slot end to end as a client', async () => {
    mockCatalog();
    let sent: Record<string, unknown> | null = null;
    server.use(
      signedInAs(demoUsers.client),
      http.post('*/api/bookings', async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ booking: booking() }, { status: 201 });
      }),
    );
    const { user } = renderApp(`/negocios/estudio-lumen/reservar?servicio=${services[0]!.id}`);

    await user.click(await screen.findByRole('button', { name: /cualquiera disponible/i }));
    // The first day with free slots is preselected; closed days are disabled.
    expect(
      await screen.findByRole('button', { name: /domingo 6 de enero: sin horarios/i }),
    ).toBeDisabled();
    await user.click(await screen.findByRole('button', { name: /09:15/ }));

    const summary = await screen.findByRole('heading', { name: /confirma tu reserva/i });
    const card = summary.closest('div')!;
    // "Any professional" resolves to the first professional free at 09:15.
    expect(within(card).getByText('Martín Paz')).toBeInTheDocument();
    expect(within(card).getByText('09:15 a 10:00')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/notas para el negocio/i), 'Primera vez');
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }));

    expect(await screen.findByRole('heading', { name: /reserva registrada/i })).toBeInTheDocument();
    expect(sent).toEqual({
      serviceId: services[0]!.id,
      professionalId: professionals[1]!.id,
      startsAt: availability.slots[1]!.startsAt,
      notes: 'Primera vez',
    });
  });

  it('asks anonymous visitors to log in, keeping the selection in the URL', async () => {
    mockCatalog();
    const start = availability.slots[0]!.startsAt;
    renderApp(
      `/negocios/estudio-lumen/reservar?servicio=${services[0]!.id}&profesional=${professionals[0]!.id}&fecha=2030-01-07&inicio=${encodeURIComponent(start)}`,
    );
    expect(await screen.findByText(/ingresa para confirmar la reserva/i)).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /^ingresar$/i });
    const withNext = links.find((l) => l.getAttribute('href')!.startsWith('/ingresar?next='));
    // The next URL is itself URL-encoded inside the query string.
    expect(decodeURIComponent(decodeURIComponent(withNext!.getAttribute('href')!))).toContain(
      `inicio=${start}`,
    );
  });

  it('returns to the time step when the slot was just taken (RN-006)', async () => {
    mockCatalog();
    server.use(
      signedInAs(demoUsers.client),
      http.post('*/api/bookings', () =>
        apiError(409, 'SLOT_TAKEN', 'Ese horario acaba de ser reservado. Elige otro, por favor.'),
      ),
    );
    const start = availability.slots[0]!.startsAt;
    const { user, router } = renderApp(
      `/negocios/estudio-lumen/reservar?servicio=${services[0]!.id}&profesional=cualquiera&fecha=2030-01-07&inicio=${encodeURIComponent(start)}`,
    );
    await user.click(await screen.findByRole('button', { name: /confirmar reserva/i }));
    await waitFor(() => expect(router.state.location.search).not.toContain('inicio='));
    expect(await screen.findByRole('button', { name: /09:00/ })).toBeInTheDocument();
  });

  it('warns admins that only clients can book', async () => {
    mockCatalog();
    server.use(signedInAs(demoUsers.admin));
    const start = availability.slots[0]!.startsAt;
    renderApp(
      `/negocios/estudio-lumen/reservar?servicio=${services[0]!.id}&profesional=cualquiera&fecha=2030-01-07&inicio=${encodeURIComponent(start)}`,
    );
    expect(await screen.findByText(/ingresa con una cuenta de cliente/i)).toBeInTheDocument();
  });
});

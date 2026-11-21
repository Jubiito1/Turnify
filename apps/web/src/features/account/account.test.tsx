import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { availability, booking } from '../../test/fixtures';
import { renderApp } from '../../test/render';
import { apiError, demoUsers, server, signedInAs } from '../../test/server';
import { canClientModify } from './MyBookingsPage';

const page = (items: ReturnType<typeof booking>[]) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 10,
});
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

describe('client bookings (RN-009, RN-013)', () => {
  it('computes the notice window like the backend', () => {
    const now = Date.parse('2030-01-07T00:00:00Z');
    expect(canClientModify(booking({ startsAt: '2030-01-07T13:00:00Z' }), now)).toBe(true); // 13 h ≥ 12 h
    expect(canClientModify(booking({ startsAt: '2030-01-07T11:00:00Z' }), now)).toBe(false); // 11 h < 12 h
  });

  it('lists upcoming and past bookings in tabs', async () => {
    server.use(
      signedInAs(demoUsers.client),
      http.get('*/api/bookings', ({ request }) => {
        const scope = new URL(request.url).searchParams.get('scope');
        return HttpResponse.json(
          scope === 'past'
            ? page([
                booking({
                  id: 'past-1',
                  status: 'COMPLETED',
                  startsAt: inDays(-10),
                  endsAt: inDays(-10),
                }),
              ])
            : page([booking({ startsAt: inDays(5), endsAt: inDays(5) })]),
        );
      }),
    );
    const { user } = renderApp('/mis-reservas');
    expect(await screen.findByRole('heading', { name: 'Corte y peinado' })).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Historial' }));
    expect(await screen.findByText('Completada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
  });

  it('shows a designed empty state', async () => {
    server.use(
      signedInAs(demoUsers.client),
      http.get('*/api/bookings', () => HttpResponse.json(page([]))),
    );
    renderApp('/mis-reservas');
    expect(await screen.findByText('No tienes turnos próximos')).toBeInTheDocument();
  });

  it('cancels after confirmation, sending the reason', async () => {
    let cancelled = false;
    let reason: unknown;
    server.use(
      signedInAs(demoUsers.client),
      http.get('*/api/bookings', () =>
        HttpResponse.json(
          page([
            booking({
              startsAt: inDays(5),
              endsAt: inDays(5),
              status: cancelled ? 'CANCELLED' : 'CONFIRMED',
            }),
          ]),
        ),
      ),
      http.post('*/api/bookings/:id/cancel', async ({ request }) => {
        reason = ((await request.json()) as { reason?: string }).reason;
        cancelled = true;
        return HttpResponse.json({ booking: booking({ status: 'CANCELLED' }) });
      }),
    );
    const { user } = renderApp('/mis-reservas');
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    const dialog = await screen.findByRole('dialog', { name: /cancelar esta reserva/i });
    await user.type(within(dialog).getByLabelText(/motivo/i), 'Viaje');
    await user.click(within(dialog).getByRole('button', { name: /sí, cancelar/i }));
    expect(await screen.findByText('Cancelada')).toBeInTheDocument();
    expect(reason).toBe('Viaje');
  });

  it('disables changes inside the notice window and explains why', async () => {
    server.use(
      signedInAs(demoUsers.client),
      http.get('*/api/bookings', () =>
        HttpResponse.json(
          page([
            booking({
              status: 'CONFIRMED',
              startsAt: new Date(Date.now() + 3_600_000).toISOString(),
            }),
          ]),
        ),
      ),
    );
    renderApp('/mis-reservas');
    expect(await screen.findByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reprogramar' })).toBeDisabled();
    expect(screen.getByText(/requieren 12 h de anticipación/i)).toBeInTheDocument();
  });

  it('reschedules to a new free slot (RN-016)', async () => {
    let sentStart: unknown;
    server.use(
      signedInAs(demoUsers.client),
      http.get('*/api/bookings', () =>
        HttpResponse.json(
          page([booking({ status: 'CONFIRMED', startsAt: inDays(5), endsAt: inDays(5) })]),
        ),
      ),
      http.get('*/api/businesses/estudio-lumen/availability/summary', () =>
        HttpResponse.json({
          timezone: availability.timezone,
          serviceId: availability.serviceId,
          days: [{ date: '2030-01-07', slotCount: 3 }],
        }),
      ),
      http.get('*/api/businesses/estudio-lumen/availability', () =>
        HttpResponse.json(availability),
      ),
      http.post('*/api/bookings/:id/reschedule', async ({ request }) => {
        sentStart = ((await request.json()) as { startsAt: string }).startsAt;
        return HttpResponse.json({
          booking: booking({ startsAt: availability.slots[2]!.startsAt }),
        });
      }),
    );
    const { user } = renderApp('/mis-reservas');
    await user.click(await screen.findByRole('button', { name: 'Reprogramar' }));
    const dialog = await screen.findByRole('dialog', { name: /reprogramar turno/i });
    await user.click(await within(dialog).findByRole('button', { name: /15:00/ }));
    await user.click(within(dialog).getByRole('button', { name: /mover a las 15:00/i }));
    await waitFor(() => expect(sentStart).toBe(availability.slots[2]!.startsAt));
  });
});

describe('profile', () => {
  it('updates the profile and reports a wrong current password', async () => {
    server.use(
      signedInAs(demoUsers.client),
      http.patch('*/api/auth/me', async ({ request }) => {
        const body = (await request.json()) as { name: string };
        return HttpResponse.json({ user: { ...demoUsers.client, name: body.name } });
      }),
      http.post('*/api/auth/me/password', () =>
        apiError(400, 'INVALID_CURRENT_PASSWORD', 'La contraseña actual no es correcta'),
      ),
    );
    const { user } = renderApp('/mi-perfil');
    const name = await screen.findByLabelText(/nombre y apellido/i);
    await user.clear(name);
    await user.type(name, 'Juan Carlos Pérez');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));
    await waitFor(() => expect(screen.getAllByText('Juan Carlos Pérez').length).toBeGreaterThan(0));

    await user.type(screen.getByLabelText(/contraseña actual/i), 'wrong1234');
    await user.type(screen.getByLabelText(/nueva contraseña/i), 'another123');
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }));
    expect(await screen.findByText('La contraseña actual no es correcta')).toBeInTheDocument();
  });
});

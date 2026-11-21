import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderApp } from '../../test/render';
import { demoUsers, server, signedInAs } from '../../test/server';

describe('notification center', () => {
  it('shows the unread badge and marks notifications as read', async () => {
    let read = false;
    server.use(
      signedInAs(demoUsers.client),
      http.get('*/api/notifications', () =>
        HttpResponse.json({
          unreadCount: read ? 0 : 1,
          items: [
            {
              id: 'n1',
              type: 'BOOKING_CONFIRMED',
              title: 'Reserva confirmada',
              body: 'Corte y peinado · lun 7/01 a las 09:00 · Estudio Lumen',
              bookingId: null,
              readAt: read ? new Date().toISOString() : null,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      ),
      http.post('*/api/notifications/read-all', () => {
        read = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderApp('/');
    const bell = await screen.findByRole('button', { name: 'Notificaciones, 1 sin leer' });
    await user.click(bell);
    const panel = screen.getByRole('region', { name: 'Notificaciones' });
    expect(within(panel).getByText('Reserva confirmada')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: /marcar todas como leídas/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeInTheDocument(),
    );
  });

  it('is hidden for visitors', async () => {
    renderApp('/');
    expect(await screen.findByRole('link', { name: /^ingresar$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /notificaciones/i })).not.toBeInTheDocument();
  });
});

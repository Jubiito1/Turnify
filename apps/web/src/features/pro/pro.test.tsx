import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { booking } from '../../test/fixtures';
import { renderApp } from '../../test/render';
import { demoUsers, proPanelHandlers, server, signedInAs } from '../../test/server';

const past = booking({
  status: 'CONFIRMED',
  startsAt: '2030-01-07T12:00:00.000Z',
  endsAt: '2030-01-07T12:45:00.000Z',
});

describe('professional panel (RN-010, RN-026, RN-033)', () => {
  it('shows its agenda and lets it complete a started booking', async () => {
    let status: unknown;
    const realNow = Date.now;
    Date.now = () => Date.parse('2030-01-07T13:00:00.000Z'); // the appointment already started
    try {
      server.use(
        signedInAs(demoUsers.pro),
        http.get('*/api/pro/bookings', () =>
          HttpResponse.json({ items: [past], total: 1, page: 1, pageSize: 100 }),
        ),
        http.patch('*/api/pro/bookings/:id/status', async ({ request }) => {
          status = ((await request.json()) as { status: string }).status;
          return HttpResponse.json({ booking: { ...past, status: 'COMPLETED' } });
        }),
        ...proPanelHandlers(),
      );
      const { user } = renderApp('/pro?vista=semana&fecha=2030-01-07');
      await user.click(await screen.findByRole('listitem', { name: /09:00 corte y peinado/i }));
      const dialog = await screen.findByRole('dialog', { name: 'Corte y peinado' });
      // Professionals cannot cancel or reschedule from their panel.
      expect(
        within(dialog).queryByRole('button', { name: /cancelar reserva/i }),
      ).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: 'Reprogramar' })).not.toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Marcar completada' }));
      await waitFor(() => expect(status).toBe('COMPLETED'));
    } finally {
      Date.now = realNow;
    }
  });

  it('hides completion actions without the permission', async () => {
    server.use(
      signedInAs(demoUsers.pro),
      http.get('*/api/pro/bookings', () =>
        HttpResponse.json({ items: [past], total: 1, page: 1, pageSize: 100 }),
      ),
      ...proPanelHandlers({ canCompleteBookings: false }),
    );
    const { user } = renderApp('/pro?vista=semana&fecha=2030-01-07');
    expect(await screen.findByText(/no habilitó que completes turnos/i)).toBeInTheDocument();
    await user.click(await screen.findByRole('listitem', { name: /09:00 corte y peinado/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Corte y peinado' });
    expect(within(dialog).getByText(/no hay acciones disponibles/i)).toBeInTheDocument();
  });

  it('shows blocks read-only when the professional cannot manage them', async () => {
    server.use(signedInAs(demoUsers.pro), ...proPanelHandlers({ canManageBlocks: false }));
    renderApp('/pro/bloqueos');
    expect(await screen.findByText(/solo el administrador puede crearlos/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo bloqueo' })).not.toBeInTheDocument();
  });
});

import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { booking } from '../../test/fixtures';
import { renderApp } from '../../test/render';
import { adminPanelHandlers, demoUsers, server, signedInAs } from '../../test/server';

const stats = {
  range: { from: '2030-01-06', to: '2030-01-07' },
  totals: {
    bookings: 12,
    active: 3,
    completed: 8,
    cancelled: 1,
    noShow: 0,
    revenueCents: 14400000,
    expectedRevenueCents: 5400000,
    uniqueClients: 9,
    cancellationRate: 0.0833,
    occupancyRate: 0.625,
  },
  byService: [
    { serviceId: 's1', name: 'Corte y peinado', bookings: 7, completed: 5, revenueCents: 9000000 },
    { serviceId: 's2', name: 'Brushing', bookings: 4, completed: 3, revenueCents: 2700000 },
  ],
  byProfessional: [
    {
      professionalId: 'p1',
      name: 'Lucía Fernández',
      bookings: 11,
      completed: 8,
      revenueCents: 14400000,
      bookedMinutes: 450,
      availableMinutes: 720,
    },
  ],
  byDay: [
    { date: '2030-01-06', bookings: 0, revenueCents: 0 },
    { date: '2030-01-07', bookings: 11, revenueCents: 14400000 },
  ],
};

describe('admin dashboard (RN-022)', () => {
  it('shows KPIs, rankings and an accessible daily chart from the stats API', async () => {
    let requested = '';
    server.use(
      signedInAs(demoUsers.admin),
      http.get('*/api/admin/stats', ({ request }) => {
        requested = new URL(request.url).search;
        return HttpResponse.json({ stats });
      }),
      ...adminPanelHandlers(), // generic fallbacks go last: the first matching handler wins
    );
    const { user } = renderApp('/admin');

    const kpis = await screen.findByRole('region', { name: 'Indicadores' });
    expect(within(kpis).getByText('12')).toBeInTheDocument();
    expect(within(kpis).getByText(/144\.000/)).toBeInTheDocument();
    expect(within(kpis).getByText('62.5%')).toBeInTheDocument();
    expect(within(kpis).getByText('8.3%')).toBeInTheDocument();

    expect(screen.getByText('Corte y peinado')).toBeInTheDocument();
    expect(screen.getAllByText('Lucía Fernández').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /lun 7\/01: 11 reservas/i })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Período'), '7');
    await waitFor(() => expect(requested).toMatch(/from=.*&to=/));
  });

  it('confirms pending bookings from the dashboard', async () => {
    let confirmed = false;
    server.use(
      signedInAs(demoUsers.admin),
      http.get('*/api/admin/bookings', () =>
        HttpResponse.json(
          confirmed
            ? { items: [], total: 0, page: 1, pageSize: 5 }
            : { items: [booking()], total: 1, page: 1, pageSize: 5 },
        ),
      ),
      http.patch('*/api/admin/bookings/:id/status', () => {
        confirmed = true;
        return HttpResponse.json({ booking: booking({ status: 'CONFIRMED' }) });
      }),
      ...adminPanelHandlers(), // generic fallbacks go last: the first matching handler wins
    );
    const { user } = renderApp('/admin');
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Todo al día')).toBeInTheDocument();
  });
});

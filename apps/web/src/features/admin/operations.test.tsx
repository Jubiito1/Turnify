import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { booking, business } from '../../test/fixtures';
import { renderApp } from '../../test/render';
import { adminPanelHandlers, demoUsers, server, signedInAs } from '../../test/server';
import { localToIso, monthGrid, weekRange } from '../../lib/calendar';

const adminBusiness = http.get('*/api/admin/business', () => HttpResponse.json({ business }));

describe('calendar helpers', () => {
  it('builds Monday-first weeks and whole-week month grids', () => {
    expect(weekRange('2030-01-09', business.timezone)).toMatchObject({
      from: '2030-01-07',
      to: '2030-01-13',
    });
    const grid = monthGrid('2030-01-15', business.timezone);
    expect(grid.from).toBe('2029-12-31');
    expect(grid.days.length % 7).toBe(0);
  });

  it('converts local business time to UTC instants (RN-019)', () => {
    expect(localToIso('2030-01-07', '09:00', 'America/Argentina/Buenos_Aires')).toBe(
      '2030-01-07T12:00:00.000Z',
    );
  });
});

describe('admin calendar', () => {
  it('places bookings in the week view and opens their actions', async () => {
    let status: unknown;
    server.use(
      signedInAs(demoUsers.admin),
      adminBusiness,
      http.get('*/api/admin/bookings/calendar', () =>
        HttpResponse.json({
          items: [
            booking({
              status: 'PENDING',
              startsAt: '2030-01-07T12:00:00.000Z',
              endsAt: '2030-01-07T12:45:00.000Z',
            }),
          ],
        }),
      ),
      http.get('*/api/admin/blocks', () => HttpResponse.json({ items: [] })),
      http.patch('*/api/admin/bookings/:id/status', async ({ request }) => {
        status = ((await request.json()) as { status: string }).status;
        return HttpResponse.json({ booking: booking({ status: 'CONFIRMED' }) });
      }),
      ...adminPanelHandlers(),
    );
    const { user } = renderApp('/admin/calendario?vista=semana&fecha=2030-01-07');
    const event = await screen.findByRole('listitem', {
      name: /09:00 corte y peinado con lucía fernández, cliente juan pérez/i,
    });
    await user.click(event);
    const dialog = await screen.findByRole('dialog', { name: 'Corte y peinado' });
    // Future booking: completing or marking no-show is not offered (RN-026).
    expect(within(dialog).queryByRole('button', { name: /completada/i })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(status).toBe('CONFIRMED'));
  });

  it('switches to the month view', async () => {
    server.use(
      signedInAs(demoUsers.admin),
      adminBusiness,
      http.get('*/api/admin/bookings/calendar', () => HttpResponse.json({ items: [booking()] })),
      http.get('*/api/admin/blocks', () => HttpResponse.json({ items: [] })),
      ...adminPanelHandlers(),
    );
    const { user } = renderApp('/admin/calendario?fecha=2030-01-07');
    await user.click(await screen.findByRole('tab', { name: 'Mes' }));
    expect(
      await screen.findByRole('button', { name: /lunes 7 de enero: 1 turnos/i }),
    ).toBeInTheDocument();
  });
});

describe('admin bookings table', () => {
  it('filters through the API and keeps the CSV link in sync', async () => {
    const queries: string[] = [];
    server.use(
      signedInAs(demoUsers.admin),
      adminBusiness,
      http.get('*/api/admin/bookings', ({ request }) => {
        queries.push(new URL(request.url).search);
        return HttpResponse.json({ items: [booking()], total: 1, page: 1, pageSize: 15 });
      }),
      ...adminPanelHandlers(),
    );
    const { user } = renderApp('/admin/reservas');
    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Estado'), 'PENDING');
    await waitFor(() => expect(queries.at(-1)).toContain('status=PENDING'));
    expect(screen.getByRole('link', { name: /exportar csv/i }).getAttribute('href')).toContain(
      '/api/admin/bookings/export.csv?status=PENDING',
    );
  });
});

describe('blocks and settings', () => {
  it('creates a block in business local time (RN-005)', async () => {
    let body: Record<string, string> | null = null;
    server.use(
      signedInAs(demoUsers.admin),
      adminBusiness,
      http.get('*/api/admin/professionals', () =>
        HttpResponse.json({
          items: [
            {
              id: 'p0000000-0000-4000-8000-000000000001',
              displayName: 'Lucía',
              bio: null,
              isActive: true,
              canManageBlocks: false,
              canCompleteBookings: true,
              account: null,
              serviceIds: [],
              workingHours: [],
            },
          ],
        }),
      ),
      http.get('*/api/admin/blocks', () => HttpResponse.json({ items: [] })),
      http.post('*/api/admin/blocks', async ({ request }) => {
        body = (await request.json()) as Record<string, string>;
        return HttpResponse.json({ block: {} }, { status: 201 });
      }),
      ...adminPanelHandlers(),
    );
    const { user } = renderApp('/admin/bloqueos');
    await user.click(await screen.findByRole('button', { name: 'Nuevo bloqueo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo bloqueo' });
    const day = within(dialog).getByLabelText('Día') as HTMLInputElement;
    await user.clear(day);
    await user.type(day, '2030-01-07');
    await user.type(within(dialog).getByLabelText('Motivo (opcional)'), 'Trámite');
    await user.click(within(dialog).getByRole('button', { name: 'Crear bloqueo' }));
    await waitFor(() =>
      expect(body).toEqual({
        professionalId: 'p0000000-0000-4000-8000-000000000001',
        startsAt: '2030-01-07T12:00:00.000Z',
        endsAt: '2030-01-07T16:00:00.000Z',
        reason: 'Trámite',
      }),
    );
  });

  it('saves the cancellation policy (RN-013)', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      signedInAs(demoUsers.admin),
      adminBusiness,
      http.put('*/api/admin/business', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ business: { ...business, ...body } });
      }),
      ...adminPanelHandlers(),
    );
    const { user } = renderApp('/admin/configuracion');
    const hours = await screen.findByLabelText(/anticipación mínima/i);
    await user.clear(hours);
    await user.type(hours, '48');
    // happy-dom does not apply a select's initial value; choose it explicitly (verified in Chromium).
    await user.selectOptions(screen.getByLabelText('Intervalo entre turnos'), '30');
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    await waitFor(() =>
      expect(body).toMatchObject({
        cancellationMinHours: 48,
        slotIntervalMinutes: 30,
        autoConfirm: false,
      }),
    );
  });
});

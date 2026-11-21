import type { ProfessionalDTO } from '@turnify/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderApp } from '../../test/render';
import { adminPanelHandlers, apiError, demoUsers, server, signedInAs } from '../../test/server';
import type { AdminService } from './queries';

const service = (overrides: Partial<AdminService> = {}): AdminService => ({
  id: 's1',
  name: 'Corte',
  description: null,
  durationMinutes: 30,
  priceCents: 1500000,
  isActive: true,
  professionalCount: 1,
  ...overrides,
});

const professional = (overrides: Partial<ProfessionalDTO> = {}): ProfessionalDTO => ({
  id: 'p1',
  displayName: 'Lucía',
  bio: null,
  isActive: true,
  canManageBlocks: false,
  canCompleteBookings: true,
  account: null,
  serviceIds: ['s1'],
  workingHours: [{ weekday: 1, startMinute: 540, endMinute: 780 }],
  ...overrides,
});

describe('admin services (RN-017, RN-018)', () => {
  it('creates a service converting the decimal price into integer cents', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      signedInAs(demoUsers.admin),
      http.post('*/api/admin/services', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ service: service() }, { status: 201 });
      }),
      ...adminPanelHandlers(),
    );
    const { user } = renderApp('/admin/servicios');
    await user.click(await screen.findByRole('button', { name: 'Crear servicio' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo servicio' });
    await user.type(within(dialog).getByLabelText(/nombre/i), 'Color');
    await user.selectOptions(within(dialog).getByLabelText(/duración/i), '45');
    await user.type(within(dialog).getByLabelText(/precio/i), '1500,50');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(body).toMatchObject({
        name: 'Color',
        durationMinutes: 45,
        priceCents: 150050,
        isActive: true,
      }),
    );
  });

  it('rejects invalid prices before calling the API', async () => {
    server.use(signedInAs(demoUsers.admin), ...adminPanelHandlers());
    const { user } = renderApp('/admin/servicios');
    await user.click(await screen.findByRole('button', { name: 'Crear servicio' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo servicio' });
    await user.type(within(dialog).getByLabelText(/nombre/i), 'Color');
    await user.type(within(dialog).getByLabelText(/precio/i), '12.345');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(await within(dialog).findByText(/ingresa un precio válido/i)).toBeInTheDocument();
  });

  it('toggles activation and explains why services with bookings cannot be deleted', async () => {
    let patched: unknown;
    server.use(
      signedInAs(demoUsers.admin),
      http.get('*/api/admin/services', () => HttpResponse.json({ items: [service()] })),
      http.patch('*/api/admin/services/:id', async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json({ service: service({ isActive: false }) });
      }),
      http.delete('*/api/admin/services/:id', () =>
        apiError(
          409,
          'SERVICE_HAS_BOOKINGS',
          'El servicio tiene reservas registradas. Desactívalo en lugar de eliminarlo.',
        ),
      ),
      ...adminPanelHandlers(),
    );
    const { user } = renderApp('/admin/servicios');
    await user.click(await screen.findByRole('switch', { name: /desactivar corte/i }));
    await waitFor(() => expect(patched).toEqual({ isActive: false }));

    await user.click(screen.getByRole('button', { name: 'Eliminar Corte' }));
    const dialog = await screen.findByRole('dialog', { name: /eliminar servicio/i });
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
    // The dialog stays open (the delete failed); the toast shows the API message.
    expect(within(dialog).getByRole('button', { name: 'Eliminar' })).toBeEnabled();
  });
});

describe('admin professionals (RN-003, RN-030, RN-033)', () => {
  it('lists professionals with services and access status', async () => {
    server.use(
      signedInAs(demoUsers.admin),
      http.get('*/api/admin/services', () => HttpResponse.json({ items: [service()] })),
      http.get('*/api/admin/professionals', () =>
        HttpResponse.json({ items: [professional({ account: { email: 'lucia@x.dev' } })] }),
      ),
      ...adminPanelHandlers(),
    );
    renderApp('/admin/profesionales');
    expect(await screen.findByRole('heading', { name: 'Lucía' })).toBeInTheDocument();
    expect(screen.getByText('Con acceso')).toBeInTheDocument();
    expect(screen.getByText('Corte')).toBeInTheDocument();
  });

  it('edits the weekly schedule and validates overlapping ranges client-side', async () => {
    let saved: unknown;
    server.use(
      signedInAs(demoUsers.admin),
      http.get('*/api/admin/professionals/p1', () =>
        HttpResponse.json({ professional: professional() }),
      ),
      http.put('*/api/admin/professionals/p1/working-hours', async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json({ professional: professional() });
      }),
      http.get('*/api/admin/services', () => HttpResponse.json({ items: [service()] })),
      ...adminPanelHandlers(),
    );
    const { user } = renderApp('/admin/profesionales/p1');
    await user.click(await screen.findByRole('button', { name: 'Agregar franja el Lunes' }));
    const start = screen.getAllByLabelText('Lunes desde')[1]!;
    await user.clear(start);
    await user.type(start, '12:00');
    await user.click(screen.getByRole('button', { name: 'Guardar horario' }));
    expect(await screen.findByText(/franjas horarias superpuestas/i)).toBeInTheDocument();
    expect(saved).toBeUndefined();

    await user.click(screen.getByRole('button', { name: /quitar franja 12:00/i }));
    await user.click(screen.getByRole('button', { name: 'Copiar lunes a martes–viernes' }));
    await user.click(screen.getByRole('button', { name: 'Guardar horario' }));
    await waitFor(() =>
      expect(saved).toEqual({
        hours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 540, endMinute: 780 })),
      }),
    );
  });

  it('shows the onboarding checklist while setup is incomplete', async () => {
    server.use(signedInAs(demoUsers.admin), ...adminPanelHandlers());
    renderApp('/admin');
    expect(
      await screen.findByRole('heading', { name: 'Configura tu negocio' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/0 de 4 pasos completos/)).toBeInTheDocument();
  });
});

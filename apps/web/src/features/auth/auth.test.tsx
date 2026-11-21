import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderApp } from '../../test/render';
import { adminPanelHandlers, apiError, demoUsers, server } from '../../test/server';

describe('login', () => {
  it('validates required fields on the client before calling the API', async () => {
    const { user } = renderApp('/ingresar');
    await user.click(await screen.findByRole('button', { name: /^ingresar$/i }));
    expect(await screen.findByText('Email inválido')).toBeInTheDocument();
    expect(screen.getByText('Ingresa tu contraseña')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows the API error for wrong credentials', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        apiError(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos'),
      ),
    );
    const { user } = renderApp('/ingresar');
    await user.type(await screen.findByLabelText('Email'), 'ana@test.dev');
    await user.type(screen.getByLabelText('Contraseña'), 'wrongpass1');
    await user.click(screen.getByRole('button', { name: /^ingresar$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos');
  });

  it('logs in and lands on the home of the role (admin panel)', async () => {
    let loggedIn = false;
    server.use(
      http.post('*/api/auth/login', async ({ request }) => {
        const body = (await request.json()) as { email: string };
        expect(body.email).toBe('admin@turnify.demo');
        loggedIn = true;
        return HttpResponse.json({ user: demoUsers.admin });
      }),
      http.get('*/api/auth/session', () =>
        HttpResponse.json({ user: loggedIn ? demoUsers.admin : null }),
      ),
      ...adminPanelHandlers(),
    );
    const { user, router } = renderApp('/ingresar');
    await user.click(await screen.findByRole('button', { name: 'Administrador' }));
    await user.click(screen.getByRole('button', { name: /^ingresar$/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin'));
    expect(await screen.findByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
  });

  it('ignores unsafe external "next" redirects', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.json({ user: demoUsers.client })));
    const { user, router } = renderApp('/ingresar?next=//evil.example');
    await user.type(await screen.findByLabelText('Email'), 'cliente@turnify.demo');
    await user.type(screen.getByLabelText('Contraseña'), 'Demo1234');
    await user.click(screen.getByRole('button', { name: /^ingresar$/i }));
    await waitFor(() => expect(router.state.location.pathname).not.toBe('/ingresar'));
    expect(router.state.location.pathname.startsWith('//')).toBe(false);
  });
});

describe('registration', () => {
  it('enforces the password policy shared with the backend (RN-031)', async () => {
    const { user } = renderApp('/registro');
    await user.type(await screen.findByLabelText(/nombre y apellido/i), 'Ana Gómez');
    await user.type(screen.getByLabelText(/^email/i), 'ana@test.dev');
    await user.type(screen.getByLabelText(/^contraseña/i), 'soloLetras');
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));
    expect(
      await screen.findByText('La contraseña debe incluir al menos un número'),
    ).toBeInTheDocument();
  });

  it('shows server-side conflicts such as a taken email', async () => {
    server.use(
      http.post('*/api/auth/register', () =>
        apiError(409, 'EMAIL_TAKEN', 'Ya existe una cuenta con ese email'),
      ),
    );
    const { user } = renderApp('/registro');
    await user.type(await screen.findByLabelText(/nombre y apellido/i), 'Ana Gómez');
    await user.type(screen.getByLabelText(/^email/i), 'ana@test.dev');
    await user.type(screen.getByLabelText(/^contraseña/i), 'turnify2026');
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ya existe una cuenta con ese email',
    );
  });

  it('maps backend validation details onto fields', async () => {
    server.use(
      http.post('*/api/auth/register', () =>
        apiError(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos', [
          { path: 'phone', message: 'Teléfono inválido' },
        ]),
      ),
    );
    const { user } = renderApp('/registro');
    await user.type(await screen.findByLabelText(/nombre y apellido/i), 'Ana Gómez');
    await user.type(screen.getByLabelText(/^email/i), 'ana@test.dev');
    await user.type(screen.getByLabelText(/^contraseña/i), 'turnify2026');
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));
    expect(await screen.findByText('Teléfono inválido')).toBeInTheDocument();
  });

  it('walks the business onboarding in two steps', async () => {
    const { user } = renderApp('/registro-negocio');
    expect(await screen.findByText(/paso 1 de 2/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    expect(await screen.findByText('Email inválido')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/tu nombre/i), 'Marta Díaz');
    await user.type(screen.getByLabelText(/^email/i), 'marta@test.dev');
    await user.type(screen.getByLabelText(/^contraseña/i), 'turnify2026');
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    expect(await screen.findByText(/paso 2 de 2/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/zona horaria/i)).toHaveValue('America/Argentina/Buenos_Aires');
  });
});

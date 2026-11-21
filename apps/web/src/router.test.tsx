import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from './router';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe('app routing', () => {
  it('renders the landing page at /', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/turnos sin vueltas/i);
  });

  it('renders a 404 page for unknown routes', () => {
    renderAt('/this/does/not/exist');
    expect(
      screen.getByRole('heading', { name: /no encontramos esta página/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver al inicio/i })).toHaveAttribute('href', '/');
  });
});

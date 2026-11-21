import { Link, NavLink, Outlet } from 'react-router';
import { clsx } from 'clsx';
import { Logo } from '../components/Logo';
import { useAuth } from '../features/auth/AuthProvider';
import { ACCOUNT_LINKS } from './nav';
import { UserMenu } from './UserMenu';

export const PUBLIC_NAV: { to: string; label: string }[] = [{ to: '/explorar', label: 'Explorar' }];

export function PublicHeader() {
  const { user, isLoading } = useAuth();
  return (
    <header className="sticky top-0 z-20 border-b border-sand-200/80 bg-sand-50/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" aria-label="Turnify, ir al inicio" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
          {PUBLIC_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                  isActive ? 'text-pine-800' : 'text-sand-600 hover:text-sand-900',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {isLoading ? null : user ? (
            <UserMenu links={ACCOUNT_LINKS[user.role]} />
          ) : (
            <>
              <Link
                to="/ingresar"
                className="rounded-xl px-3 py-2 text-sm font-semibold text-sand-700 hover:bg-sand-100"
              >
                Ingresar
              </Link>
              <Link
                to="/registro"
                className="rounded-xl bg-pine-700 px-4 py-2 text-sm font-semibold text-white hover:bg-pine-800"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2"
      >
        Saltar al contenido
      </a>
      <PublicHeader />
      <main id="contenido" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-sand-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-sand-500 sm:flex-row">
          <Logo className="scale-90" />
          <p>Turnify · Proyecto final Generación T · 2026</p>
          <Link to="/registro-negocio" className="font-semibold text-pine-700 hover:underline">
            ¿Tienes un negocio? Súmate gratis
          </Link>
        </div>
      </footer>
    </div>
  );
}

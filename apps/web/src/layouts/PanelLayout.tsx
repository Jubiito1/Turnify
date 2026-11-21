import { clsx } from 'clsx';
import { Menu, X } from 'lucide-react';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Logo } from '../components/Logo';
import { useAuth } from '../features/auth/AuthProvider';
import { ACCOUNT_LINKS } from './nav';
import { NotificationBell } from '../features/notifications/NotificationBell';
import { UserMenu } from './UserMenu';

export interface PanelNavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}

/** Sidebar layout shared by the admin and professional panels; collapses to a drawer on mobile. */
export function PanelLayout({
  nav,
  title,
  subtitle,
  headerExtra,
}: {
  nav: PanelNavItem[];
  title: string;
  subtitle?: ReactNode;
  headerExtra?: ReactNode;
}) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const navList = (
    <nav aria-label={title} className="flex flex-col gap-1">
      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
              isActive
                ? 'bg-pine-700 text-white shadow-sm'
                : 'text-sand-700 hover:bg-sand-100 hover:text-sand-900',
            )
          }
        >
          <item.icon className="size-5 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2"
      >
        Saltar al contenido
      </a>
      <aside className="hidden border-r border-sand-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="border-b border-sand-100 px-5 py-5">
          <Link to="/" aria-label="Turnify, ir al inicio">
            <Logo />
          </Link>
          <p className="mt-3 truncate text-sm font-semibold text-sand-900">{title}</p>
          {subtitle && <p className="truncate text-xs text-sand-500">{subtitle}</p>}
        </div>
        <div className="flex-1 overflow-y-auto p-3">{navList}</div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menú"
        >
          <div className="absolute inset-0 bg-pine-950/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white p-4 shadow-pop animate-slide-up">
            <div className="mb-4 flex items-center justify-between">
              <Logo />
              <button
                type="button"
                className="rounded-lg p-2 hover:bg-sand-100"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar menú"
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="mb-3 px-1 text-sm font-semibold text-sand-900">{title}</p>
            {navList}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-sand-200 bg-sand-50/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-sand-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            {headerExtra}
            <NotificationBell />
            {user && <UserMenu links={ACCOUNT_LINKS[user.role]} />}
          </div>
        </header>
        <main id="contenido" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

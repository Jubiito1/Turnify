import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo } from '../../components/Logo';

/** Split layout used by login and registration screens. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-pine-800 p-12 text-sand-50 lg:flex lg:flex-col lg:justify-between">
        <Link to="/" aria-label="Turnify, ir al inicio">
          <Logo inverted />
        </Link>
        <div className="relative z-10 max-w-md">
          <p className="font-display text-4xl leading-tight font-extrabold text-white">
            Tu agenda, siempre en orden.
          </p>
          <p className="mt-4 text-pine-100">
            Reservas con disponibilidad real, sin superposiciones y con recordatorios dentro de la
            app.
          </p>
        </div>
        <p className="relative z-10 text-sm text-pine-200">Turnify · Turnos sin vueltas</p>
        <div
          aria-hidden="true"
          className="absolute -right-24 -bottom-24 size-96 rounded-full bg-pine-600/40"
        />
        <div
          aria-hidden="true"
          className="absolute top-24 -right-10 size-40 rounded-full bg-apricot-500/30"
        />
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 inline-block lg:hidden" aria-label="Turnify, ir al inicio">
            <Logo />
          </Link>
          <h1 className="text-3xl font-extrabold">{title}</h1>
          <p className="mt-2 text-sand-600">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-center text-sm text-sand-600">{footer}</div>
        </div>
      </main>
    </div>
  );
}

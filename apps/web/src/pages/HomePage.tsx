import { Logo } from '../components/Logo';

export function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-start justify-center gap-6 px-4">
      <Logo />
      <h1 className="text-4xl font-extrabold sm:text-6xl">
        Turnos sin vueltas para <span className="text-pine-600">tu negocio</span>.
      </h1>
      <p className="max-w-xl text-lg text-sand-600">
        Reservas online con disponibilidad real, agenda de profesionales y métricas en un solo
        lugar.
      </p>
    </main>
  );
}

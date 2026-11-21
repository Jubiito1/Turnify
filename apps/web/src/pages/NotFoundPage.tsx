import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-display text-7xl font-extrabold text-pine-200">404</p>
      <h1 className="text-2xl font-bold">No encontramos esta página</h1>
      <p className="text-sand-600">Puede que el enlace esté roto o que la página se haya movido.</p>
      <Link
        to="/"
        className="rounded-xl bg-pine-700 px-5 py-2.5 font-semibold text-white hover:bg-pine-800"
      >
        Volver al inicio
      </Link>
    </main>
  );
}

import { useQuery } from '@tanstack/react-query';
import { BUSINESS_CATEGORIES, BUSINESS_CATEGORY_LABELS } from '@turnify/shared';
import { CalendarCheck, Clock, Search, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Feedback';
import { BusinessCard } from '../features/catalog/BusinessCard';
import { CategoryIcon } from '../features/catalog/CategoryIcon';
import { catalogQueries } from '../features/catalog/queries';

const STEPS = [
  {
    icon: Search,
    title: 'Elige el servicio',
    text: 'Explora negocios cercanos y compara servicios, duración y precio.',
  },
  {
    icon: Clock,
    title: 'Encuentra tu horario',
    text: 'Ves solo horarios realmente libres, calculados en tiempo real.',
  },
  {
    icon: CalendarCheck,
    title: 'Reserva en segundos',
    text: 'Confirma, reprograma o cancela desde tu cuenta cuando quieras.',
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const featured = useQuery(catalogQueries.list({ pageSize: 6 }));

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/explorar${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`);
  };

  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-32 -right-32 size-[28rem] rounded-full bg-pine-100/70 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 -left-24 size-[22rem] rounded-full bg-apricot-100/80 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-pine-200 bg-white px-3 py-1 text-sm font-semibold text-pine-700">
              <ShieldCheck className="size-4" aria-hidden="true" /> Disponibilidad real, sin
              superposiciones
            </p>
            <h1 className="mt-5 text-4xl leading-[1.05] font-extrabold sm:text-6xl">
              Turnos sin vueltas para <span className="text-pine-600">tu negocio</span> y tus
              clientes.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-sand-600">
              Reserva en peluquerías, consultorios, estudios y más. Y si tienes un negocio, gestiona
              agenda, profesionales y métricas en un solo lugar.
            </p>
            <form
              onSubmit={onSearch}
              role="search"
              className="mt-8 flex max-w-xl flex-col gap-2 sm:flex-row"
            >
              <label htmlFor="home-search" className="sr-only">
                Buscar negocios
              </label>
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-sand-400"
                  aria-hidden="true"
                />
                <input
                  id="home-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Peluquería, kinesiología, barbería…"
                  className="h-12 w-full rounded-xl border border-sand-300 bg-white pr-4 pl-12 text-base shadow-sm focus:border-pine-500 focus:ring-3 focus:ring-pine-200 focus:outline-none"
                />
              </div>
              <Button type="submit" variant="accent" size="lg">
                Buscar turno
              </Button>
            </form>
          </div>

          <div className="relative hidden lg:block" aria-hidden="true">
            <div className="rotate-2 rounded-3xl border border-sand-200 bg-white p-6 shadow-pop">
              <p className="text-sm font-semibold text-sand-500">Jueves 4 de diciembre</p>
              <p className="mt-1 font-display text-2xl font-bold">Corte y peinado</p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {['09:00', '09:15', '10:30', '11:00', '15:45', '16:00'].map((t, i) => (
                  <span
                    key={t}
                    className={`rounded-xl border px-3 py-2 text-center text-sm font-semibold ${i === 2 ? 'border-pine-700 bg-pine-700 text-white' : 'border-sand-200 text-sand-700'}`}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between rounded-2xl bg-pine-50 px-4 py-3">
                <span className="text-sm font-semibold text-pine-800">Con Lucía · 45 min</span>
                <span className="font-display font-bold text-pine-800">$18.000</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-4">
        <h2 className="text-2xl font-bold">Explora por rubro</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BUSINESS_CATEGORIES.map((category) => (
            <Link
              key={category}
              to={`/explorar?rubro=${category}`}
              className="flex items-center gap-3 rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sm font-semibold text-sand-800 transition hover:border-pine-300 hover:bg-pine-50"
            >
              <CategoryIcon category={category} className="size-5 text-pine-600" />
              {BUSINESS_CATEGORY_LABELS[category]}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold">Negocios en Turnify</h2>
          <Link to="/explorar" className="text-sm font-semibold text-pine-700 hover:underline">
            Ver todos
          </Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.isLoading
            ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-48" />)
            : featured.data?.items.map((b) => <BusinessCard key={b.id} business={b} />)}
        </div>
        {featured.isError && (
          <p className="mt-4 text-sm text-sand-500">
            No pudimos cargar los negocios destacados. El servidor puede estar iniciando; vuelve a
            intentarlo en unos segundos.
          </p>
        )}
      </section>

      <section className="bg-pine-800 text-pine-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-bold text-white">Cómo funciona</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-2xl bg-pine-700/60 p-6">
                <span className="flex size-11 items-center justify-center rounded-xl bg-apricot-500 text-pine-950">
                  <step.icon className="size-5" aria-hidden="true" />
                </span>
                <p className="mt-4 text-sm font-semibold text-apricot-200">Paso {i + 1}</p>
                <h3 className="mt-1 text-xl font-bold text-white">{step.title}</h3>
                <p className="mt-2 text-pine-100">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-apricot-200 bg-apricot-50 p-8 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold">¿Tienes un negocio con turnos?</h2>
            <p className="mt-2 max-w-xl text-sand-700">
              Configura servicios, profesionales y horarios en minutos. Tus clientes reservan solos
              y tú ves todo en tu panel.
            </p>
          </div>
          <Link
            to="/registro-negocio"
            className="rounded-xl bg-pine-700 px-6 py-3 font-semibold text-white hover:bg-pine-800"
          >
            Registrar mi negocio
          </Link>
        </div>
      </section>
    </>
  );
}

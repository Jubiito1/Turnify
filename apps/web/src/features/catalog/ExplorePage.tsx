import { useQuery } from '@tanstack/react-query';
import {
  BUSINESS_CATEGORIES,
  BUSINESS_CATEGORY_LABELS,
  type BusinessCategory,
} from '@turnify/shared';
import { clsx } from 'clsx';
import { Search, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { BusinessCard } from './BusinessCard';
import { catalogQueries } from './queries';

const PAGE_SIZE = 9;

function isCategory(value: string | null): value is BusinessCategory {
  return value !== null && (BUSINESS_CATEGORIES as readonly string[]).includes(value);
}

/** Business search with text, category filter and pagination, all mirrored in the URL. */
export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const rubro = params.get('rubro');
  const category = isCategory(rubro) ? rubro : undefined;
  const page = Math.max(1, Number(params.get('pagina') ?? 1) || 1);
  const [text, setText] = useState(q);

  // Debounce typing into the URL (and therefore the query).
  useEffect(() => {
    const id = setTimeout(() => {
      if (text.trim() === q) return;
      const next = new URLSearchParams(params);
      if (text.trim()) next.set('q', text.trim());
      else next.delete('q');
      next.delete('pagina');
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(id);
  }, [text, q, params, setParams]);

  const { data, isLoading, isFetching, error, refetch } = useQuery(
    catalogQueries.list({ q: q || undefined, category, page, pageSize: PAGE_SIZE }),
  );

  const setCategory = (value?: BusinessCategory) => {
    const next = new URLSearchParams(params);
    if (value) next.set('rubro', value);
    else next.delete('rubro');
    next.delete('pagina');
    setParams(next);
  };
  const setPage = (value: number) => {
    const next = new URLSearchParams(params);
    next.set('pagina', String(value));
    setParams(next);
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-extrabold sm:text-4xl">Explorar negocios</h1>
      <p className="mt-2 text-sand-600">Encuentra dónde reservar tu próximo turno.</p>

      <div className="mt-6 flex flex-col gap-4">
        <div className="relative max-w-xl">
          <label htmlFor="explore-search" className="sr-only">
            Buscar por nombre, descripción o zona
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-sand-400"
            aria-hidden="true"
          />
          <input
            id="explore-search"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Buscar por nombre, descripción o zona"
            className="h-11 w-full rounded-xl border border-sand-300 bg-white pr-4 pl-11 focus:border-pine-500 focus:ring-3 focus:ring-pine-200 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por rubro">
          <Chip active={!category} onClick={() => setCategory(undefined)}>
            Todos
          </Chip>
          {BUSINESS_CATEGORIES.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {BUSINESS_CATEGORY_LABELS[c]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-8" aria-live="polite" aria-busy={isFetching}>
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-sand-500">
              {data.total} negocio{data.total === 1 ? '' : 's'} encontrado
              {data.total === 1 ? '' : 's'}
            </p>
            <div
              className={clsx(
                'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
                isFetching && 'opacity-70',
              )}
            >
              {data.items.map((b) => (
                <BusinessCard key={b.id} business={b} />
              ))}
            </div>
            {totalPages > 1 && (
              <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Paginación">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </Button>
                <span className="text-sm text-sand-600">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Siguiente
                </Button>
              </nav>
            )}
          </>
        ) : (
          <EmptyState
            icon={<SearchX className="size-6" />}
            title="No encontramos negocios"
            description="Prueba con otra búsqueda o quita el filtro de rubro."
            action={
              (q || category) && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setText('');
                    setParams({});
                  }}
                >
                  Limpiar filtros
                </Button>
              )
            }
          />
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        'rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
        active
          ? 'border-pine-700 bg-pine-700 text-white'
          : 'border-sand-300 bg-white text-sand-700 hover:border-pine-300',
      )}
    >
      {children}
    </button>
  );
}

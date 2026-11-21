import { usePageTitle } from '../../lib/usePageTitle';
import { useQuery } from '@tanstack/react-query';
import { BUSINESS_CATEGORY_LABELS } from '@turnify/shared';
import { Clock, MapPin, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { ApiError } from '../../lib/api';
import { formatDuration, formatPrice } from '../../lib/format';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { CategoryIcon } from './CategoryIcon';
import { catalogQueries } from './queries';

export function BusinessPage() {
  const { slug = '' } = useParams();
  const { data, isLoading, error, refetch } = useQuery(catalogQueries.business(slug));
  usePageTitle(data?.business.name);

  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />;
  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-10">
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const { business, services, professionals } = data;
  const prosFor = (serviceId: string) =>
    professionals.filter((p) => p.serviceIds.includes(serviceId));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <section className="rounded-3xl border border-sand-200 bg-white p-6 shadow-card sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-pine-700 text-white">
            <CategoryIcon category={business.category} className="size-8" />
          </span>
          <div className="min-w-0 flex-1">
            <Badge tone="pine">{BUSINESS_CATEGORY_LABELS[business.category]}</Badge>
            <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{business.name}</h1>
            {business.description && (
              <p className="mt-3 max-w-2xl text-sand-600">{business.description}</p>
            )}
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-sand-600">
              {business.address && (
                <li className="flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden="true" /> {business.address}
                </li>
              )}
              {business.phone && (
                <li className="flex items-center gap-1.5">
                  <Phone className="size-4" aria-hidden="true" /> {business.phone}
                </li>
              )}
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="size-4" aria-hidden="true" />
                {business.cancellationMinHours > 0
                  ? `Cancelación gratuita hasta ${business.cancellationMinHours} h antes`
                  : 'Cancelación gratuita en cualquier momento'}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section aria-labelledby="services-title">
          <h2 id="services-title" className="text-2xl font-bold">
            Servicios
          </h2>
          {services.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="Este negocio aún no publicó servicios"
                description="Vuelve a intentarlo más adelante."
              />
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {services.map((service) => {
                const available = prosFor(service.id).length > 0;
                return (
                  <li key={service.id}>
                    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold">{service.name}</h3>
                        {service.description && (
                          <p className="mt-1 text-sm text-sand-600">{service.description}</p>
                        )}
                        <p className="mt-2 flex items-center gap-3 text-sm text-sand-500">
                          <span className="flex items-center gap-1">
                            <Clock className="size-4" aria-hidden="true" />{' '}
                            {formatDuration(service.durationMinutes)}
                          </span>
                          <span className="font-display text-base font-bold text-sand-900">
                            {formatPrice(service.priceCents)}
                          </span>
                        </p>
                      </div>
                      {available ? (
                        <Link
                          to={`/negocios/${business.slug}/reservar?servicio=${service.id}`}
                          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-apricot-500 px-5 text-sm font-semibold text-pine-950 hover:bg-apricot-400"
                          aria-label={`Reservar ${service.name}`}
                        >
                          Reservar
                        </Link>
                      ) : (
                        <span className="text-sm text-sand-500">Sin profesionales disponibles</span>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside aria-labelledby="team-title">
          <h2 id="team-title" className="text-2xl font-bold">
            Equipo
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {professionals.map((p) => (
              <li key={p.id}>
                <Card className="flex gap-3 p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sand-100 text-sand-600">
                    <UserRound className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">{p.displayName}</p>
                    {p.bio && <p className="text-sm text-sand-600">{p.bio}</p>}
                  </div>
                </Card>
              </li>
            ))}
            {professionals.length === 0 && (
              <p className="text-sm text-sand-500">Sin profesionales publicados.</p>
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}

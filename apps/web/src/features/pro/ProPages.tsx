import { keepPreviousData, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { BookingDTO, Paginated } from '@turnify/shared';
import { CalendarCheck2, Info } from 'lucide-react';
import { useState } from 'react';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { api } from '../../lib/api';
import { formatPrice, formatShortDateTime, formatTime, todayIn } from '../../lib/format';
import { BlocksManager } from '../admin/BlocksPage';
import { BookingDetailDialog } from '../admin/BookingDetailDialog';
import { AgendaCalendar } from '../admin/CalendarPage';
import { proProfileQuery } from './ProLayout';

const proStatusEndpoint = (id: string) => `/pro/bookings/${id}/status`;

/** RN-010: the professional only ever sees its own agenda (the API scopes every query). */
export function ProAgendaPage() {
  const profile = useQuery(proProfileQuery);
  const [selected, setSelected] = useState<BookingDTO | null>(null);
  const tz = profile.data?.business.timezone;
  const today = tz ? todayIn(tz) : '';

  const todays = useQuery({
    queryKey: ['pro', 'bookings', 'today', today],
    queryFn: () =>
      api<Paginated<BookingDTO>>('/pro/bookings', {
        query: {
          from: today,
          to: today,
          status: 'PENDING,CONFIRMED,COMPLETED,NO_SHOW',
          pageSize: 50,
        },
      }),
    enabled: Boolean(tz),
  });

  if (profile.error) return <ErrorState error={profile.error} onRetry={profile.refetch} />;
  if (!profile.data || !tz) return <Skeleton className="h-96" />;

  const bookingsQuery = (from: string, to: string): UseQueryOptions<BookingDTO[]> => ({
    queryKey: ['pro', 'agenda', from, to],
    queryFn: () =>
      api<Paginated<BookingDTO>>('/pro/bookings', { query: { from, to, pageSize: 100 } }).then(
        (r) => r.items,
      ),
  });
  const next = todays.data?.items.find(
    (b) =>
      new Date(b.endsAt).getTime() > Date.now() &&
      b.status !== 'COMPLETED' &&
      b.status !== 'NO_SHOW',
  );

  return (
    <>
      <PageHeader title="Mi agenda" description={profile.data.business.name} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-4 p-5">
          <span className="flex size-11 items-center justify-center rounded-xl bg-pine-50 text-pine-700">
            <CalendarCheck2 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-sand-600">Turnos de hoy</p>
            <p className="font-display text-2xl font-extrabold">{todays.data?.total ?? '—'}</p>
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-semibold text-sand-600">Próximo turno</p>
          {next ? (
            <p className="mt-1 font-semibold">
              {formatTime(next.startsAt, tz)} · {next.client.name} · {next.service.name}
            </p>
          ) : (
            <p className="mt-1 text-sand-500">No te quedan turnos hoy.</p>
          )}
        </Card>
      </div>
      {!profile.data.canCompleteBookings && (
        <Alert tone="info" className="mb-4">
          <Info className="mr-1 inline size-4" aria-hidden="true" /> El administrador no habilitó
          que completes turnos desde tu panel.
        </Alert>
      )}
      <AgendaCalendar timezone={tz} bookingsQuery={bookingsQuery} onSelect={setSelected} />
      {selected && (
        <BookingDetailDialog
          booking={selected}
          onClose={() => setSelected(null)}
          statusEndpoint={proStatusEndpoint}
          rescheduleEndpoint={null}
          allowedActions={profile.data.canCompleteBookings ? ['COMPLETED', 'NO_SHOW'] : []}
        />
      )}
    </>
  );
}

export function ProHistoryPage() {
  const profile = useQuery(proProfileQuery);
  const tz = profile.data?.business.timezone ?? 'America/Argentina/Buenos_Aires';
  const [page, setPage] = useState(1);
  const today = todayIn(tz);
  const { data, error, refetch } = useQuery({
    queryKey: ['pro', 'history', page, today],
    queryFn: () =>
      api<Paginated<BookingDTO>>('/pro/bookings', { query: { to: today, page, pageSize: 20 } }),
    placeholderData: keepPreviousData,
    enabled: Boolean(profile.data),
  });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  return (
    <>
      <PageHeader
        title="Historial"
        description="Tus turnos hasta hoy, del más reciente al más antiguo."
      />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !data ? (
        <Skeleton className="h-72" />
      ) : data.items.length === 0 ? (
        <EmptyState title="Todavía no hay historial" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <caption className="sr-only">Historial de turnos</caption>
              <thead className="bg-sand-50 text-xs text-sand-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Servicio</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {data.items.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatShortDateTime(b.startsAt, tz)}
                    </td>
                    <td className="px-4 py-3">{b.client.name}</td>
                    <td className="px-4 py-3">{b.service.name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatPrice(b.priceCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-sand-100 px-4 py-3 text-sm text-sand-600">
            <span>{data.total} turnos</span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <span>
                {page} / {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}

/** RN-033: blocks are editable only with the canManageBlocks permission (enforced by the API). */
export function ProBlocksPage() {
  const profile = useQuery(proProfileQuery);
  if (!profile.data) return <Skeleton className="h-64" />;
  return (
    <>
      <PageHeader title="Mis bloqueos" description="Horarios en los que no atiendes." />
      {!profile.data.canManageBlocks && (
        <Alert tone="info" className="mb-4">
          Puedes ver tus bloqueos, pero solo el administrador puede crearlos o eliminarlos.
        </Alert>
      )}
      <BlocksManager
        timezone={profile.data.business.timezone}
        endpoint="/pro/blocks"
        canEdit={profile.data.canManageBlocks}
      />
    </>
  );
}

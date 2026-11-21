import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BookingDTO, Paginated } from '@turnify/shared';
import { clsx } from 'clsx';
import { CalendarClock, CalendarPlus, Store } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/Feedback';
import { TextAreaField } from '../../components/ui/Field';
import { api, errorMessage } from '../../lib/api';
import { capitalize, formatLongDate, formatPrice, formatTime, toZoned } from '../../lib/format';
import { RescheduleDialog } from './RescheduleDialog';

type Scope = 'upcoming' | 'past';
const PAGE_SIZE = 10;

export const clientBookingsKey = (scope: Scope, page: number) =>
  ['client', 'bookings', scope, page] as const;

/** RN-013: the client can change a booking only with the configured minimum notice. */
export function canClientModify(booking: BookingDTO, now = Date.now()): boolean {
  const hoursLeft = (new Date(booking.startsAt).getTime() - now) / 3_600_000;
  return hoursLeft >= booking.business.cancellationMinHours;
}

export function MyBookingsPage() {
  const [params, setParams] = useSearchParams();
  const scope: Scope = params.get('ver') === 'historial' ? 'past' : 'upcoming';
  const page = Math.max(1, Number(params.get('pagina') ?? 1) || 1);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: clientBookingsKey(scope, page),
    queryFn: () =>
      api<Paginated<BookingDTO>>('/bookings', { query: { scope, page, pageSize: PAGE_SIZE } }),
    placeholderData: keepPreviousData,
  });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        title="Mis reservas"
        description="Consulta, reprograma o cancela tus turnos."
        actions={
          <Link
            to="/explorar"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-pine-700 px-4 text-sm font-semibold text-white hover:bg-pine-800"
          >
            <CalendarPlus className="size-4" aria-hidden="true" /> Nueva reserva
          </Link>
        }
      />

      <div
        role="tablist"
        aria-label="Reservas"
        className="mb-6 inline-flex rounded-xl border border-sand-200 bg-white p-1"
      >
        {(['upcoming', 'past'] as const).map((s) => (
          <button
            key={s}
            role="tab"
            type="button"
            aria-selected={scope === s}
            onClick={() => setParams(s === 'past' ? { ver: 'historial' } : {})}
            className={clsx(
              'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              scope === s ? 'bg-pine-700 text-white' : 'text-sand-600 hover:text-sand-900',
            )}
          >
            {s === 'upcoming' ? 'Próximas' : 'Historial'}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-busy={isFetching}>
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <SkeletonList rows={3} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="size-6" />}
            title={scope === 'upcoming' ? 'No tienes turnos próximos' : 'Todavía no hay historial'}
            description={
              scope === 'upcoming'
                ? 'Cuando reserves un turno lo verás aquí.'
                : 'Aquí aparecerán tus turnos pasados y cancelados.'
            }
            action={
              scope === 'upcoming' && (
                <Link
                  to="/explorar"
                  className="rounded-xl bg-pine-700 px-4 py-2 text-sm font-semibold text-white hover:bg-pine-800"
                >
                  Buscar un turno
                </Link>
              )
            }
          />
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {data.items.map((b) => (
                <li key={b.id}>
                  <BookingCard booking={b} />
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Paginación">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() =>
                    setParams({
                      ...(scope === 'past' ? { ver: 'historial' } : {}),
                      pagina: String(page - 1),
                    })
                  }
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
                  onClick={() =>
                    setParams({
                      ...(scope === 'past' ? { ver: 'historial' } : {}),
                      pagina: String(page + 1),
                    })
                  }
                >
                  Siguiente
                </Button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function BookingCard({ booking }: { booking: BookingDTO }) {
  const tz = booking.business.timezone;
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [reason, setReason] = useState('');
  const isActive = booking.status === 'PENDING' || booking.status === 'CONFIRMED';
  const isUpcoming = new Date(booking.startsAt).getTime() > Date.now();
  const modifiable = canClientModify(booking);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['client', 'bookings'] });

  const cancel = useMutation({
    mutationFn: () =>
      api<{ booking: BookingDTO }>(`/bookings/${booking.id}/cancel`, {
        method: 'POST',
        body: { reason: reason || undefined },
      }),
    onSuccess: () => {
      toast.success('Reserva cancelada');
      setCancelOpen(false);
      refresh();
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Card className={clsx('p-5', booking.status === 'CANCELLED' && 'opacity-75')}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="flex w-16 shrink-0 flex-col items-center rounded-2xl bg-pine-50 py-2 text-pine-800">
            <span className="text-xs font-semibold uppercase">
              {toZoned(booking.startsAt, tz).toFormat('ccc')}
            </span>
            <span className="font-display text-2xl font-bold">
              {toZoned(booking.startsAt, tz).toFormat('d')}
            </span>
            <span className="text-xs">{formatTime(booking.startsAt, tz)}</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold">{booking.service.name}</h3>
              <StatusBadge status={booking.status} />
            </div>
            <p className="mt-1 text-sm text-sand-600">
              {capitalize(formatLongDate(booking.startsAt, tz))} ·{' '}
              {formatTime(booking.startsAt, tz)} a {formatTime(booking.endsAt, tz)}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-sand-600">
              <span className="inline-flex items-center gap-1">
                <Store className="size-4" aria-hidden="true" />
                <Link
                  to={`/negocios/${booking.business.slug}`}
                  className="font-semibold text-pine-700 hover:underline"
                >
                  {booking.business.name}
                </Link>
              </span>
              <span>Con {booking.professional.displayName}</span>
              <span className="font-semibold text-sand-900">{formatPrice(booking.priceCents)}</span>
            </p>
            {booking.cancellationReason && (
              <p className="mt-1 text-sm text-sand-500">
                Motivo de cancelación: {booking.cancellationReason}
              </p>
            )}
          </div>
        </div>

        {isActive && isUpcoming && (
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={!modifiable}
                onClick={() => setRescheduleOpen(true)}
              >
                Reprogramar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-700 hover:bg-red-50 hover:text-red-800"
                disabled={!modifiable}
                onClick={() => setCancelOpen(true)}
              >
                Cancelar
              </Button>
            </div>
            {!modifiable && (
              <p className="max-w-[16rem] text-xs text-sand-500">
                Los cambios online requieren {booking.business.cancellationMinHours} h de
                anticipación. Contacta al negocio.
              </p>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="¿Cancelar esta reserva?"
        description={`${booking.service.name} · ${capitalize(formatLongDate(booking.startsAt, tz))} a las ${formatTime(booking.startsAt, tz)}. El horario quedará libre para otra persona.`}
        confirmLabel="Sí, cancelar"
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
      >
        <TextAreaField
          label="Motivo (opcional)"
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </ConfirmDialog>

      {rescheduleOpen && (
        <RescheduleDialog
          booking={booking}
          open={rescheduleOpen}
          onOpenChange={setRescheduleOpen}
          endpoint={`/bookings/${booking.id}/reschedule`}
          onDone={refresh}
        />
      )}
    </Card>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BookingDTO, Paginated, StatsDTO } from '@turnify/shared';
import { CalendarCheck2, CircleDollarSign, Gauge, Users, XCircle, Clock3 } from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, PageHeader } from '../../components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { SelectField } from '../../components/ui/Field';
import { api, errorMessage } from '../../lib/api';
import { formatDayLabel, formatPrice, formatShortDateTime, todayIn } from '../../lib/format';
import { DateTime } from 'luxon';
import { adminBusinessQuery } from './AdminLayout';
import { DailyBarChart } from './DailyBarChart';
import { OnboardingChecklist } from './OnboardingChecklist';

const RANGES = [
  { days: 7, label: 'Últimos 7 días' },
  { days: 30, label: 'Últimos 30 días' },
  { days: 90, label: 'Últimos 90 días' },
];

const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;

export function DashboardPage() {
  const business = useQuery(adminBusinessQuery);
  const tz = business.data?.timezone ?? 'America/Argentina/Buenos_Aires';
  const [days, setDays] = useState(30);
  const to = todayIn(tz);
  const from = DateTime.fromISO(to, { zone: tz })
    .minus({ days: days - 1 })
    .toISODate()!;

  const stats = useQuery({
    queryKey: ['admin', 'stats', from, to],
    queryFn: () =>
      api<{ stats: StatsDTO }>('/admin/stats', { query: { from, to } }).then((r) => r.stats),
    enabled: business.isSuccess,
  });

  return (
    <>
      <PageHeader
        title="Resumen"
        description={business.data ? `Métricas de ${business.data.name}` : undefined}
        actions={
          <SelectField
            label="Período"
            containerClassName="w-48"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {RANGES.map((r) => (
              <option key={r.days} value={r.days}>
                {r.label}
              </option>
            ))}
          </SelectField>
        }
      />

      <OnboardingChecklist />

      {stats.error ? (
        <ErrorState error={stats.error} onRetry={stats.refetch} />
      ) : !stats.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <StatsView stats={stats.data} timezone={tz} />
      )}

      <PendingBookings timezone={tz} />
    </>
  );
}

function StatsView({ stats, timezone }: { stats: StatsDTO; timezone: string }) {
  const t = stats.totals;
  const maxService = Math.max(1, ...stats.byService.map((s) => s.bookings));
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          icon={CalendarCheck2}
          label="Reservas"
          value={String(t.bookings)}
          hint={`${t.completed} completadas · ${t.active} activas`}
        />
        <StatTile
          icon={CircleDollarSign}
          label="Ingresos"
          value={formatPrice(t.revenueCents)}
          hint={`${formatPrice(t.expectedRevenueCents)} en reservas activas`}
        />
        <StatTile
          icon={Gauge}
          label="Ocupación"
          value={percent(t.occupancyRate)}
          hint="Minutos reservados sobre horario ofrecido"
        />
        <StatTile
          icon={Users}
          label="Clientes únicos"
          value={String(t.uniqueClients)}
          hint="Con reservas no canceladas"
        />
        <StatTile
          icon={XCircle}
          label="Cancelaciones"
          value={percent(t.cancellationRate)}
          hint={`${t.cancelled} canceladas · ${t.noShow} ausencias`}
        />
        <StatTile
          icon={Clock3}
          label="Período"
          value={`${stats.byDay.length} días`}
          hint={`${formatDayLabel(stats.range.from, timezone)} al ${formatDayLabel(stats.range.to, timezone)}`}
        />
      </section>

      <Card>
        <CardHeader
          title="Reservas por día"
          description="Reservas no canceladas según la fecha del turno."
        />
        <div className="p-5">
          <DailyBarChart data={stats.byDay} timezone={timezone} />
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold text-pine-700">Ver como tabla</summary>
            <div className="mt-3 max-h-64 overflow-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-sand-500 uppercase">
                  <tr>
                    <th className="py-1.5">Día</th>
                    <th className="py-1.5 text-right">Reservas</th>
                    <th className="py-1.5 text-right">Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byDay.map((d) => (
                    <tr key={d.date} className="border-t border-sand-100">
                      <td className="py-1.5">{formatDayLabel(d.date, timezone)}</td>
                      <td className="py-1.5 text-right tabular-nums">{d.bookings}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatPrice(d.revenueCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Servicios más reservados" />
          <div className="p-5">
            {stats.byService.length === 0 ? (
              <p className="text-sm text-sand-500">Sin reservas en el período.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {stats.byService.map((s) => (
                  <li key={s.serviceId}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="truncate font-semibold">{s.name}</span>
                      <span className="shrink-0 text-sand-600 tabular-nums">
                        {s.bookings} · {formatPrice(s.revenueCents)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-sand-100" aria-hidden="true">
                      <div
                        className="h-2 rounded-full bg-pine-500"
                        style={{ width: `${(s.bookings / maxService) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Rendimiento por profesional" />
          <div className="overflow-x-auto p-5">
            {stats.byProfessional.length === 0 ? (
              <p className="text-sm text-sand-500">Sin datos en el período.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-sand-500 uppercase">
                  <tr>
                    <th className="pb-2">Profesional</th>
                    <th className="pb-2 text-right">Reservas</th>
                    <th className="pb-2 text-right">Ingresos</th>
                    <th className="pb-2 text-right">Ocupación</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byProfessional.map((p) => (
                    <tr key={p.professionalId} className="border-t border-sand-100">
                      <td className="py-2 font-semibold">{p.name}</td>
                      <td className="py-2 text-right tabular-nums">{p.bookings}</td>
                      <td className="py-2 text-right tabular-nums">
                        {formatPrice(p.revenueCents)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {p.availableMinutes > 0
                          ? percent(p.bookedMinutes / p.availableMinutes)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-sand-600">
        <span className="flex size-8 items-center justify-center rounded-lg bg-pine-50 text-pine-700">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        {label}
      </div>
      <p className="mt-3 font-display text-3xl font-extrabold text-sand-900 tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-xs text-sand-500">{hint}</p>
    </Card>
  );
}

/** Quick action list: pending bookings waiting for confirmation. */
function PendingBookings({ timezone }: { timezone: string }) {
  const queryClient = useQueryClient();
  const pending = useQuery({
    queryKey: ['admin', 'bookings', 'pending'],
    queryFn: () =>
      api<Paginated<BookingDTO>>('/admin/bookings', { query: { status: 'PENDING', pageSize: 5 } }),
  });
  const confirm = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/bookings/${id}/status`, { method: 'PATCH', body: { status: 'CONFIRMED' } }),
    onSuccess: () => {
      toast.success('Reserva confirmada');
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Card className="mt-6">
      <CardHeader
        title="Pendientes de confirmación"
        description={pending.data ? `${pending.data.total} en total` : undefined}
      />
      <div className="p-5">
        {pending.error ? (
          <ErrorState error={pending.error} onRetry={pending.refetch} />
        ) : !pending.data ? (
          <Skeleton className="h-24" />
        ) : pending.data.items.length === 0 ? (
          <EmptyState title="Todo al día" description="No hay reservas esperando confirmación." />
        ) : (
          <ul className="divide-y divide-sand-100">
            {pending.data.items.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {b.client.name} · {b.service.name}
                  </p>
                  <p className="text-sm text-sand-500">
                    {formatShortDateTime(b.startsAt, timezone)} · {b.professional.displayName}
                  </p>
                </div>
                <Button
                  size="sm"
                  loading={confirm.isPending && confirm.variables === b.id}
                  onClick={() => confirm.mutate(b.id)}
                >
                  Confirmar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

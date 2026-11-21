import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { BookingDTO, TimeBlockDTO } from '@turnify/shared';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DateTime } from 'luxon';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { STATUS_TONE } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { ErrorState, Skeleton } from '../../components/ui/Feedback';
import { SelectField } from '../../components/ui/Field';
import { api } from '../../lib/api';
import {
  layoutLanes,
  localDate,
  minuteOfDay,
  monthGrid,
  shiftDate,
  weekRange,
} from '../../lib/calendar';
import { capitalize, formatTime, todayIn } from '../../lib/format';
import { adminBusinessQuery } from './AdminLayout';
import { BookingDetailDialog } from './BookingDetailDialog';
import { adminQueries } from './queries';

const HOUR_PX = 56;
const STATUS_STYLE: Record<string, string> = {
  apricot: 'border-apricot-400 bg-apricot-50 text-apricot-700',
  pine: 'border-pine-500 bg-pine-50 text-pine-900',
  sky: 'border-sky-400 bg-sky-50 text-sky-900',
  rose: 'border-rose-400 bg-rose-50 text-rose-800',
  muted: 'border-sand-300 bg-sand-50 text-sand-500 line-through',
};

/** Shared week/month calendar used by the admin panel (and, scoped, by the professional panel). */
export function AgendaCalendar({
  timezone,
  bookingsQuery,
  blocksQuery,
  onSelect,
  professionalFilter,
}: {
  timezone: string;
  bookingsQuery: (from: string, to: string) => UseQueryOptions<BookingDTO[]>;
  blocksQuery?: (from: string, to: string) => UseQueryOptions<TimeBlockDTO[]>;
  onSelect: (booking: BookingDTO) => void;
  professionalFilter?: React.ReactNode;
}) {
  const [params, setParams] = useSearchParams();
  const view = params.get('vista') === 'mes' ? 'month' : 'week';
  const anchor = params.get('fecha') ?? todayIn(timezone);
  const range = view === 'week' ? weekRange(anchor, timezone) : monthGrid(anchor, timezone);
  const { data, isLoading, error, refetch } = useQuery(bookingsQuery(range.from, range.to));
  const blocksResult = useQuery({
    ...(blocksQuery?.(range.from, range.to) ?? { queryKey: ['no-blocks'], queryFn: () => [] }),
    enabled: Boolean(blocksQuery),
  });
  const blocks = blocksResult.data ?? [];

  const set = (changes: Record<string, string>) =>
    setParams({ vista: view === 'month' ? 'mes' : 'semana', fecha: anchor, ...changes });
  const title =
    view === 'week'
      ? `${DateTime.fromISO(range.from).setLocale('es').toFormat('d LLL')} – ${DateTime.fromISO(range.to).setLocale('es').toFormat('d LLL yyyy')}`
      : capitalize(DateTime.fromISO(anchor).setLocale('es').toFormat('LLLL yyyy'));

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => set({ fecha: todayIn(timezone) })}>
            Hoy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Anterior"
            onClick={() =>
              set({
                fecha: shiftDate(
                  anchor,
                  timezone,
                  view === 'week' ? { weeks: -1 } : { months: -1 },
                ),
              })
            }
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Siguiente"
            onClick={() =>
              set({
                fecha: shiftDate(anchor, timezone, view === 'week' ? { weeks: 1 } : { months: 1 }),
              })
            }
          >
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="ml-1 text-base font-bold" aria-live="polite">
            {title}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {professionalFilter}
          <div
            role="tablist"
            aria-label="Vista"
            className="inline-flex rounded-xl border border-sand-200 p-0.5"
          >
            {(['week', 'month'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                type="button"
                aria-selected={view === v}
                onClick={() => set({ vista: v === 'month' ? 'mes' : 'semana' })}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-sm font-semibold',
                  view === v ? 'bg-pine-700 text-white' : 'text-sand-600',
                )}
              >
                {v === 'week' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="p-5">
          <ErrorState error={error} onRetry={refetch} />
        </div>
      ) : isLoading || !data ? (
        <Skeleton className="m-5 h-96" />
      ) : view === 'week' ? (
        <WeekView
          days={range.days}
          timezone={timezone}
          bookings={data}
          blocks={blocks}
          onSelect={onSelect}
        />
      ) : (
        <MonthView
          days={range.days}
          month={(range as ReturnType<typeof monthGrid>).month}
          timezone={timezone}
          bookings={data}
          onPickDay={(day) => setParams({ vista: 'semana', fecha: day })}
        />
      )}
    </Card>
  );
}

function WeekView({
  days,
  timezone,
  bookings: all,
  blocks,
  onSelect,
}: {
  days: string[];
  timezone: string;
  bookings: BookingDTO[];
  blocks: TimeBlockDTO[];
  onSelect: (b: BookingDTO) => void;
}) {
  // Cancelled bookings do not occupy the agenda (RN-012); they remain visible in the bookings table.
  const bookings = all.filter((b) => b.status !== 'CANCELLED');
  const lanes = layoutLanes(bookings);
  const minutes = bookings.flatMap((b) => [
    minuteOfDay(b.startsAt, timezone),
    minuteOfDay(b.endsAt, timezone) || 1440,
  ]);
  const startHour = Math.min(8, ...minutes.map((m) => Math.floor(m / 60)));
  const endHour = Math.max(20, ...minutes.map((m) => Math.ceil(m / 60)));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const today = todayIn(timezone);
  const top = (iso: string) => ((minuteOfDay(iso, timezone) - startHour * 60) / 60) * HOUR_PX;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b border-sand-100 text-center text-xs font-semibold text-sand-600">
          <span />
          {days.map((d) => {
            const dt = DateTime.fromISO(d).setLocale('es');
            return (
              <span key={d} className={clsx('py-2', d === today && 'text-pine-700')}>
                {capitalize(dt.toFormat('ccc'))}{' '}
                <span
                  className={clsx(
                    'ml-0.5 inline-flex size-6 items-center justify-center rounded-full',
                    d === today && 'bg-pine-700 text-white',
                  )}
                >
                  {dt.day}
                </span>
              </span>
            );
          })}
        </div>
        <div className="relative grid grid-cols-[3.5rem_repeat(7,1fr)]">
          <div>
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_PX }}
                className="-translate-y-2 pr-2 text-right text-[11px] text-sand-400"
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          {days.map((day) => (
            <div
              key={day}
              className="relative border-l border-sand-100"
              style={{ height: hours.length * HOUR_PX }}
              aria-label={`Turnos del ${day}`}
              role="list"
            >
              {hours.map((h) => (
                <div
                  key={h}
                  style={{ height: HOUR_PX }}
                  className="border-b border-dashed border-sand-100"
                  aria-hidden="true"
                />
              ))}
              {blocks
                .filter((b) => localDate(b.startsAt, timezone) === day)
                .map((b) => (
                  <div
                    key={b.id}
                    className="absolute inset-x-0.5 rounded-md border border-sand-300 bg-[repeating-linear-gradient(45deg,var(--color-sand-100),var(--color-sand-100)_6px,white_6px,white_12px)] px-1.5 py-1 text-[11px] text-sand-600"
                    style={{
                      top: top(b.startsAt),
                      height: Math.max(18, top(b.endsAt) - top(b.startsAt)),
                    }}
                    title={`Bloqueo · ${b.professionalName}${b.reason ? ` · ${b.reason}` : ''}`}
                  >
                    Bloqueo · {b.professionalName}
                  </div>
                ))}
              {bookings
                .filter((b) => localDate(b.startsAt, timezone) === day)
                .map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    role="listitem"
                    onClick={() => onSelect(b)}
                    className={clsx(
                      'absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm hover:z-10 hover:shadow-pop focus-visible:z-10',
                      STATUS_STYLE[STATUS_TONE[b.status]],
                    )}
                    style={{
                      top: top(b.startsAt) + 1,
                      height: Math.max(20, top(b.endsAt) - top(b.startsAt) - 2),
                      left: `calc(${((lanes.get(b.id)?.lane ?? 0) / (lanes.get(b.id)?.lanes ?? 1)) * 100}% + 2px)`,
                      width: `calc(${100 / (lanes.get(b.id)?.lanes ?? 1)}% - 4px)`,
                    }}
                    aria-label={`${formatTime(b.startsAt, timezone)} ${b.service.name} con ${b.professional.displayName}, cliente ${b.client.name}`}
                  >
                    <span className="block font-semibold">
                      {formatTime(b.startsAt, timezone)} {b.client.name}
                    </span>
                    <span className="block truncate">
                      {b.service.name} · {b.professional.displayName}
                    </span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthView({
  days,
  month,
  timezone,
  bookings,
  onPickDay,
}: {
  days: string[];
  month: number;
  timezone: string;
  bookings: BookingDTO[];
  onPickDay: (d: string) => void;
}) {
  const today = todayIn(timezone);
  const byDay = new Map<string, BookingDTO[]>();
  bookings
    .filter((b) => b.status !== 'CANCELLED')
    .forEach((b) => {
      const d = localDate(b.startsAt, timezone);
      byDay.set(d, [...(byDay.get(d) ?? []), b]);
    });
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-sand-100 text-center text-xs font-semibold text-sand-600">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
          <span key={d} className="py-2">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const dt = DateTime.fromISO(d);
          const items = byDay.get(d) ?? [];
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPickDay(d)}
              aria-label={`${dt.setLocale('es').toFormat("cccc d 'de' LLLL")}: ${items.length} turnos`}
              className={clsx(
                'min-h-24 border-r border-b border-sand-100 p-1.5 text-left align-top hover:bg-pine-50/50',
                dt.month !== month && 'bg-sand-50 text-sand-400',
              )}
            >
              <span
                className={clsx(
                  'inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                  d === today && 'bg-pine-700 text-white',
                )}
              >
                {dt.day}
              </span>
              <ul className="mt-1 space-y-0.5">
                {items.slice(0, 3).map((b) => (
                  <li
                    key={b.id}
                    className="truncate rounded bg-pine-50 px-1 text-[11px] text-pine-900"
                  >
                    {formatTime(b.startsAt, timezone)} {b.client.name}
                  </li>
                ))}
                {items.length > 3 && (
                  <li className="px-1 text-[11px] font-semibold text-sand-500">
                    +{items.length - 3} más
                  </li>
                )}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarPage() {
  const business = useQuery(adminBusinessQuery);
  const professionals = useQuery(adminQueries.professionals());
  const [professionalId, setProfessionalId] = useState('');
  const [selected, setSelected] = useState<BookingDTO | null>(null);
  const tz = business.data?.timezone;

  const bookingsQuery = (from: string, to: string): UseQueryOptions<BookingDTO[]> => ({
    queryKey: ['admin', 'calendar', from, to, professionalId],
    queryFn: () =>
      api<{ items: BookingDTO[] }>('/admin/bookings/calendar', {
        query: { from, to, professionalId: professionalId || undefined },
      }).then((r) => r.items),
  });
  const blocksQuery = (from: string, to: string): UseQueryOptions<TimeBlockDTO[]> => ({
    queryKey: ['admin', 'blocks', from, to, professionalId],
    queryFn: () =>
      api<{ items: TimeBlockDTO[] }>('/admin/blocks', {
        query: { from, to, professionalId: professionalId || undefined },
      }).then((r) => r.items),
  });

  if (!tz) return <Skeleton className="h-96" />;
  return (
    <>
      <PageHeader
        title="Calendario"
        description="Agenda general del negocio. Haz clic en un turno para gestionarlo."
      />
      <AgendaCalendar
        timezone={tz}
        bookingsQuery={bookingsQuery}
        blocksQuery={blocksQuery}
        onSelect={setSelected}
        professionalFilter={
          <SelectField
            label="Profesional"
            className="h-9"
            containerClassName="[&>label]:sr-only"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
          >
            <option value="">Todos los profesionales</option>
            {professionals.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </SelectField>
        }
      />
      {selected && <BookingDetailDialog booking={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

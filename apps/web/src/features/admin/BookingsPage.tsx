import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_LABELS,
  type BookingDTO,
  type Paginated,
} from '@turnify/shared';
import { Download, Plus } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { SelectField, TextAreaField, TextField } from '../../components/ui/Field';
import { api, apiUrl, errorMessage } from '../../lib/api';
import { formatPrice, formatShortDateTime, formatTime, todayIn } from '../../lib/format';
import { DateStrip } from '../booking/DateStrip';
import { SlotPicker } from '../booking/SlotPicker';
import { catalogQueries } from '../catalog/queries';
import { adminBusinessQuery } from './AdminLayout';
import { BookingDetailDialog } from './BookingDetailDialog';
import { adminQueries } from './queries';

const PAGE_SIZE = 15;
const FILTERS = ['from', 'to', 'status', 'professionalId', 'serviceId', 'q'] as const;

export function BookingsPage() {
  const [params, setParams] = useSearchParams();
  const business = useQuery(adminBusinessQuery);
  const services = useQuery(adminQueries.services());
  const professionals = useQuery(adminQueries.professionals());
  const [selected, setSelected] = useState<BookingDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState(params.get('q') ?? '');

  const filters = Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? undefined])) as Record<
    (typeof FILTERS)[number],
    string | undefined
  >;
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next);
  };

  const list = useQuery({
    queryKey: ['admin', 'bookings', filters, page],
    queryFn: () =>
      api<Paginated<BookingDTO>>('/admin/bookings', {
        query: { ...filters, page, pageSize: PAGE_SIZE },
      }),
    placeholderData: keepPreviousData,
  });
  const tz = business.data?.timezone ?? 'America/Argentina/Buenos_Aires';
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <PageHeader
        title="Reservas"
        description="Busca, filtra, exporta y gestiona todas las reservas."
        actions={
          <>
            <a
              href={apiUrl('/admin/bookings/export.csv', filters)}
              download
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-sand-300 bg-white px-4 text-sm font-semibold text-sand-800 hover:bg-sand-100"
            >
              <Download className="size-4" aria-hidden="true" /> Exportar CSV
            </a>
            <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              Nueva reserva
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-4">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setFilter('q', q.trim());
          }}
        >
          <TextField
            label="Desde"
            type="date"
            value={filters.from ?? ''}
            onChange={(e) => setFilter('from', e.target.value)}
          />
          <TextField
            label="Hasta"
            type="date"
            value={filters.to ?? ''}
            onChange={(e) => setFilter('to', e.target.value)}
          />
          <SelectField
            label="Estado"
            value={filters.status ?? ''}
            onChange={(e) => setFilter('status', e.target.value)}
          >
            <option value="">Todos</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BOOKING_STATUS_LABELS[s]}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Profesional"
            value={filters.professionalId ?? ''}
            onChange={(e) => setFilter('professionalId', e.target.value)}
          >
            <option value="">Todos</option>
            {professionals.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Servicio"
            value={filters.serviceId ?? ''}
            onChange={(e) => setFilter('serviceId', e.target.value)}
          >
            <option value="">Todos</option>
            {services.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Cliente"
            type="search"
            placeholder="Nombre o email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => setFilter('q', q.trim())}
          />
        </form>
      </Card>

      {list.error ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : !list.data ? (
        <Skeleton className="h-96" />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          title="No hay reservas con estos filtros"
          description="Prueba con otro rango de fechas o estado."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">Listado de reservas</caption>
              <thead className="bg-sand-50 text-xs text-sand-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Servicio</th>
                  <th className="px-4 py-3">Profesional</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {list.data.items.map((b) => (
                  <tr
                    key={b.id}
                    className="cursor-pointer hover:bg-pine-50/40"
                    onClick={() => setSelected(b)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        className="font-semibold text-pine-800 hover:underline"
                        onClick={() => setSelected(b)}
                      >
                        {formatShortDateTime(b.startsAt, tz)}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-medium">{b.client.name}</span>
                      <span className="text-xs text-sand-500">{b.client.email}</span>
                    </td>
                    <td className="px-4 py-3">{b.service.name}</td>
                    <td className="px-4 py-3">{b.professional.displayName}</td>
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
            <span>{list.data.total} reservas</span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() =>
                  setParams((p) => ({ ...Object.fromEntries(p), page: String(page - 1) }))
                }
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
                onClick={() =>
                  setParams((p) => ({ ...Object.fromEntries(p), page: String(page + 1) }))
                }
              >
                Siguiente
              </Button>
            </div>
          </div>
        </Card>
      )}

      {selected && <BookingDetailDialog booking={selected} onClose={() => setSelected(null)} />}
      {creating && business.data && (
        <NewBookingDialog
          slug={business.data.slug}
          timezone={tz}
          onClose={() => setCreating(false)}
        />
      )}
    </>
  );
}

/** Manual booking on behalf of a client (walk-in or phone), using real availability. */
function NewBookingDialog({
  slug,
  timezone,
  onClose,
}: {
  slug: string;
  timezone: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const services = useQuery(adminQueries.services());
  const professionals = useQuery(adminQueries.professionals());
  const [serviceId, setServiceId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [client, setClient] = useState({ name: '', email: '' });
  const [notes, setNotes] = useState('');
  const ready = Boolean(serviceId && professionalId);

  const summary = useQuery({
    ...catalogQueries.summary(slug, {
      serviceId,
      professionalId,
      from: todayIn(timezone),
      days: 21,
    }),
    enabled: ready,
  });
  const selectedDate = date ?? summary.data?.days.find((d) => d.slotCount > 0)?.date ?? null;
  const slots = useQuery({
    ...catalogQueries.availability(slug, { serviceId, professionalId, date: selectedDate ?? '' }),
    enabled: ready && Boolean(selectedDate),
  });

  const create = useMutation({
    mutationFn: () =>
      api('/admin/bookings', {
        method: 'POST',
        body: { serviceId, professionalId, startsAt, notes: notes || undefined, client },
      }),
    onSuccess: () => {
      toast.success('Reserva creada');
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const eligible =
    professionals.data?.filter((p) => p.isActive && p.serviceIds.includes(serviceId)) ?? [];

  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(open) => !open && onClose()}
      title="Nueva reserva"
      description="Se confirma automáticamente. Si el email no tiene cuenta, se crea un cliente invitado."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!startsAt || client.name.trim().length < 2 || !client.email.includes('@')}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            {startsAt ? `Reservar a las ${formatTime(startsAt, timezone)}` : 'Elige un horario'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Nombre del cliente"
            value={client.name}
            onChange={(e) => setClient({ ...client, name: e.target.value })}
          />
          <TextField
            label="Email del cliente"
            type="email"
            value={client.email}
            onChange={(e) => setClient({ ...client, email: e.target.value })}
          />
          <SelectField
            label="Servicio"
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
              setProfessionalId('');
              setStartsAt(null);
              setDate(null);
            }}
          >
            <option value="">Elegir…</option>
            {services.data
              ?.filter((s) => s.isActive)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </SelectField>
          <SelectField
            label="Profesional"
            value={professionalId}
            disabled={!serviceId}
            onChange={(e) => {
              setProfessionalId(e.target.value);
              setStartsAt(null);
              setDate(null);
            }}
          >
            <option value="">Elegir…</option>
            {eligible.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </SelectField>
        </div>
        {serviceId && eligible.length === 0 && (
          <Alert tone="warning">Ningún profesional activo realiza este servicio.</Alert>
        )}
        {ready && summary.data && (
          <DateStrip
            days={summary.data.days}
            timezone={timezone}
            selected={selectedDate}
            onSelect={(d) => {
              setDate(d);
              setStartsAt(null);
            }}
          />
        )}
        {ready &&
          slots.data &&
          (slots.data.slots.length ? (
            <SlotPicker
              slots={slots.data.slots}
              timezone={timezone}
              selected={startsAt}
              onSelect={(s) => setStartsAt(s.startsAt)}
            />
          ) : (
            <p className="text-sm text-sand-500">Sin horarios libres ese día.</p>
          ))}
        <TextAreaField
          label="Notas (opcional)"
          value={notes}
          maxLength={500}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Dialog>
  );
}

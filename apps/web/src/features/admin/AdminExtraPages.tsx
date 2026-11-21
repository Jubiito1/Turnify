import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BUSINESS_CATEGORIES,
  BUSINESS_CATEGORY_LABELS,
  SLOT_INTERVAL_OPTIONS,
  businessSettingsSchema,
  type BusinessDetail,
  type BusinessSettingsInput,
  type ClientSummaryDTO,
  type Paginated,
} from '@turnify/shared';
import { ExternalLink, Search, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, PageHeader } from '../../components/ui/Card';
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { SelectField, SwitchField, TextAreaField, TextField } from '../../components/ui/Field';
import { api } from '../../lib/api';
import { formatShortDateTime } from '../../lib/format';
import { TIMEZONE_OPTIONS } from '../auth/RegisterBusinessPage';
import { useApiFormError } from '../auth/useApiForm';
import { adminBusinessQuery } from './AdminLayout';
import { BlocksPage } from './BlocksPage';
import { adminQueries } from './queries';

export function AdminBlocksPage() {
  const business = useQuery(adminBusinessQuery);
  const professionals = useQuery(adminQueries.professionals());
  if (!business.data || !professionals.data) return <Skeleton className="h-64" />;
  return (
    <BlocksPage
      timezone={business.data.timezone}
      professionals={professionals.data.filter((p) => p.isActive)}
    />
  );
}

export function ClientsPage() {
  const business = useQuery(adminBusinessQuery);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(text.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [text]);

  const { data, error, refetch } = useQuery({
    queryKey: ['admin', 'clients', q, page],
    queryFn: () =>
      api<Paginated<ClientSummaryDTO>>('/admin/clients', {
        query: { q: q || undefined, page, pageSize: 20 },
      }),
    placeholderData: keepPreviousData,
  });
  const tz = business.data?.timezone ?? 'America/Argentina/Buenos_Aires';
  const totalPages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Personas que reservaron al menos una vez en tu negocio."
      />
      <div className="relative mb-4 max-w-md">
        <label htmlFor="client-search" className="sr-only">
          Buscar clientes
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-sand-400"
          aria-hidden="true"
        />
        <input
          id="client-search"
          type="search"
          placeholder="Buscar por nombre, email o teléfono"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-10 w-full rounded-xl border border-sand-300 bg-white pr-3 pl-9 text-sm focus:border-pine-500 focus:ring-3 focus:ring-pine-200 focus:outline-none"
        />
      </div>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !data ? (
        <Skeleton className="h-72" />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="size-6" />}
          title="Sin clientes para mostrar"
          description={
            q
              ? 'Ningún cliente coincide con la búsqueda.'
              : 'Cuando recibas reservas, tus clientes aparecerán aquí.'
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Clientes</caption>
              <thead className="bg-sand-50 text-xs text-sand-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3 text-right">Reservas</th>
                  <th className="px-4 py-3 text-right">Completadas</th>
                  <th className="px-4 py-3">Último turno</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {data.items.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/reservas?q=${encodeURIComponent(c.email)}`}
                        className="font-semibold text-pine-800 hover:underline"
                      >
                        {c.name}
                      </Link>
                      <span className="block text-xs text-sand-500">{c.email}</span>
                    </td>
                    <td className="px-4 py-3">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.totalBookings}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.completedBookings}</td>
                    <td className="px-4 py-3">
                      {c.lastBookingAt ? formatShortDateTime(c.lastBookingAt, tz) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-sand-100 px-4 py-3 text-sm text-sand-600">
            <span>{data.total} clientes</span>
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

export function SettingsPage() {
  const business = useQuery(adminBusinessQuery);
  if (!business.data) return <Skeleton className="h-96" />;
  return <SettingsForm business={business.data} />;
}

function SettingsForm({ business }: { business: BusinessDetail }) {
  const queryClient = useQueryClient();
  const form = useForm<BusinessSettingsInput>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: {
      name: business.name,
      description: business.description ?? '',
      category: business.category,
      timezone: business.timezone,
      address: business.address ?? '',
      phone: business.phone ?? '',
      cancellationMinHours: business.cancellationMinHours,
      // Selects work with strings; the shared schema coerces them back to numbers.
      slotIntervalMinutes: String(business.slotIntervalMinutes),
      bookingHorizonDays: business.bookingHorizonDays,
      autoConfirm: business.autoConfirm,
    },
  });
  const { formError, setFormError, handleError } = useApiFormError(form.setError);
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const { business: updated } = await api<{ business: BusinessDetail }>('/admin/business', {
        method: 'PUT',
        body: values,
      });
      queryClient.setQueryData(adminBusinessQuery.queryKey, updated);
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      setFormError(null);
      toast.success('Configuración guardada');
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Datos públicos del negocio y políticas de reserva."
        actions={
          <Link
            to={`/negocios/${business.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-pine-700 hover:underline"
          >
            Ver página pública <ExternalLink className="size-4" aria-hidden="true" />
          </Link>
        }
      />
      <form onSubmit={onSubmit} noValidate className="grid gap-6 xl:grid-cols-2">
        {formError && (
          <Alert tone="error" className="xl:col-span-2">
            {formError}
          </Alert>
        )}
        <Card>
          <CardHeader title="Datos del negocio" />
          <div className="flex flex-col gap-4 p-5">
            <TextField
              label="Nombre"
              required
              error={errors.name?.message}
              {...form.register('name')}
            />
            <TextAreaField
              label="Descripción"
              error={errors.description?.message}
              {...form.register('description')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Rubro"
                error={errors.category?.message}
                {...form.register('category')}
              >
                {BUSINESS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {BUSINESS_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Zona horaria"
                error={errors.timezone?.message}
                {...form.register('timezone')}
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <TextField
              label="Dirección"
              error={errors.address?.message}
              {...form.register('address')}
            />
            <TextField
              label="Teléfono"
              type="tel"
              error={errors.phone?.message}
              {...form.register('phone')}
            />
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Políticas de reserva"
            description="Se aplican en el servidor a cada reserva."
          />
          <div className="flex flex-col gap-4 p-5">
            <TextField
              label="Anticipación mínima para cancelar o reprogramar (horas)"
              type="number"
              min={0}
              max={168}
              hint="0 permite cancelar en cualquier momento. Los administradores siempre pueden cancelar."
              error={errors.cancellationMinHours?.message}
              {...form.register('cancellationMinHours', { valueAsNumber: true })}
            />
            <SelectField
              label="Intervalo entre turnos"
              error={errors.slotIntervalMinutes?.message}
              {...form.register('slotIntervalMinutes')}
            >
              {SLOT_INTERVAL_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  Cada {m} minutos
                </option>
              ))}
            </SelectField>
            <TextField
              label="Horizonte de reserva (días)"
              type="number"
              min={1}
              max={365}
              hint="Con cuántos días de anticipación se puede reservar."
              error={errors.bookingHorizonDays?.message}
              {...form.register('bookingHorizonDays', { valueAsNumber: true })}
            />
            <SwitchField
              label="Confirmar reservas automáticamente"
              description="Si está apagado, las reservas de clientes quedan pendientes hasta que las confirmes."
              {...form.register('autoConfirm')}
            />
            <div>
              <Button type="submit" loading={isSubmitting}>
                Guardar configuración
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </>
  );
}

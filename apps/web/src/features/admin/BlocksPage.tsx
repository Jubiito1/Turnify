import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import type { TimeBlockDTO } from '@turnify/shared';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { Alert, EmptyState, ErrorState, SkeletonList } from '../../components/ui/Feedback';
import { SelectField, SwitchField, TextField } from '../../components/ui/Field';
import { api, errorMessage } from '../../lib/api';
import { localToIso } from '../../lib/calendar';
import { capitalize, formatLongDate, formatTime, todayIn } from '../../lib/format';

interface BlocksManagerProps {
  timezone: string;
  /** API base: '/admin/blocks' or '/pro/blocks'. */
  endpoint: string;
  professionals?: { id: string; displayName: string }[];
  canEdit: boolean;
}

/** Availability blocks list + creation; shared by admins (any professional) and professionals (own). */
export function BlocksManager({ timezone, endpoint, professionals, canEdit }: BlocksManagerProps) {
  const queryClient = useQueryClient();
  const query: UseQueryOptions<TimeBlockDTO[]> = {
    queryKey: ['blocks', endpoint],
    queryFn: () => api<{ items: TimeBlockDTO[] }>(endpoint).then((r) => r.items),
  };
  const { data, isLoading, error, refetch } = useQuery(query);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<TimeBlockDTO | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => api(`${endpoint}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Bloqueo eliminado');
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <div className="mb-4 flex justify-end">
        {canEdit && (
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Nuevo bloqueo
          </Button>
        )}
      </div>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <SkeletonList />
      ) : !data?.length ? (
        <EmptyState
          icon={<CalendarOff className="size-6" />}
          title="No hay bloqueos próximos"
          description="Bloquea horarios por vacaciones, trámites o feriados: no se podrán reservar."
        />
      ) : (
        <ul className="grid gap-3">
          {data.map((b) => (
            <li key={b.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">
                    {capitalize(formatLongDate(b.startsAt, timezone))} ·{' '}
                    {formatTime(b.startsAt, timezone)} a{' '}
                    {formatLongDate(b.endsAt, timezone) === formatLongDate(b.startsAt, timezone)
                      ? ''
                      : `${formatLongDate(b.endsAt, timezone)} `}
                    {formatTime(b.endsAt, timezone)}
                  </p>
                  <p className="text-sm text-sand-600">
                    {b.professionalName}
                    {b.reason ? ` · ${b.reason}` : ''}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-700 hover:bg-red-50"
                    icon={<Trash2 className="size-4" />}
                    onClick={() => setDeleting(b)}
                  >
                    Eliminar
                  </Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      {creating && (
        <NewBlockDialog
          timezone={timezone}
          endpoint={endpoint}
          professionals={professionals}
          onClose={() => setCreating(false)}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="¿Eliminar bloqueo?"
        description="El horario volverá a estar disponible para reservas."
        confirmLabel="Eliminar"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}

function NewBlockDialog({
  timezone,
  endpoint,
  professionals,
  onClose,
}: {
  timezone: string;
  endpoint: string;
  professionals?: { id: string; displayName: string }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const today = todayIn(timezone);
  const [form, setForm] = useState({
    professionalId: professionals?.[0]?.id ?? '',
    date: today,
    endDate: today,
    start: '09:00',
    end: '13:00',
    allDay: false,
    reason: '',
  });
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api(endpoint, {
        method: 'POST',
        body: {
          // Professionals block their own agenda; the API forces their id anyway.
          professionalId: form.professionalId || '00000000-0000-4000-8000-000000000000',
          startsAt: localToIso(form.date, form.allDay ? '00:00' : form.start, timezone),
          endsAt: form.allDay
            ? localToIso(form.endDate, '23:59', timezone)
            : localToIso(form.date, form.end, timezone),
          reason: form.reason || undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Bloqueo creado');
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Nuevo bloqueo"
      description="No podrá superponerse con reservas activas."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={create.isPending} onClick={() => create.mutate()}>
            Crear bloqueo
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert tone="error">{error}</Alert>}
        {professionals && (
          <SelectField
            label="Profesional"
            value={form.professionalId}
            onChange={(e) => setForm({ ...form, professionalId: e.target.value })}
          >
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </SelectField>
        )}
        <SwitchField
          label="Días completos"
          checked={form.allDay}
          onChange={(e) => setForm({ ...form, allDay: e.target.checked })}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label={form.allDay ? 'Desde el día' : 'Día'}
            type="date"
            min={today}
            value={form.date}
            onChange={(e) =>
              setForm({
                ...form,
                date: e.target.value,
                endDate: e.target.value > form.endDate ? e.target.value : form.endDate,
              })
            }
          />
          {form.allDay ? (
            <TextField
              label="Hasta el día"
              type="date"
              min={form.date}
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          ) : (
            <>
              <TextField
                label="Desde"
                type="time"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
              />
              <TextField
                label="Hasta"
                type="time"
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
              />
            </>
          )}
        </div>
        <TextField
          label="Motivo (opcional)"
          placeholder="Vacaciones, capacitación…"
          maxLength={200}
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
        />
      </div>
    </Dialog>
  );
}

export function BlocksPage({
  timezone,
  professionals,
}: {
  timezone: string;
  professionals: { id: string; displayName: string }[];
}) {
  return (
    <>
      <PageHeader title="Bloqueos" description="Horarios en los que tu equipo no atiende." />
      <BlocksManager
        timezone={timezone}
        endpoint="/admin/blocks"
        professionals={professionals}
        canEdit
      />
    </>
  );
}

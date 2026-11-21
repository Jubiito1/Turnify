import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProfessionalDTO, WorkingHourDTO } from '@turnify/shared';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, PageHeader } from '../../components/ui/Card';
import { ErrorState, SkeletonList } from '../../components/ui/Feedback';
import { SwitchField, TextAreaField, TextField } from '../../components/ui/Field';
import { api, errorMessage } from '../../lib/api';
import { formatDuration } from '../../lib/format';
import { adminQueries } from './queries';
import { WorkingHoursEditor } from './WorkingHoursEditor';

export function ProfessionalDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useQuery(adminQueries.professional(id));

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading || !data) return <SkeletonList rows={3} />;

  return (
    <>
      <Link
        to="/admin/profesionales"
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-sand-600 hover:text-sand-900"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Profesionales
      </Link>
      <PageHeader
        title={data.displayName}
        description={
          data.account ? `Acceso: ${data.account.email}` : 'Sin acceso al panel profesional'
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <ProfileCard professional={data} />
          <ServicesCard professional={data} />
        </div>
        <Card>
          <CardHeader
            title="Horario semanal"
            description="En la hora local del negocio. Puedes cargar turnos cortados."
          />
          <div className="p-5">
            <HoursSection professional={data} />
          </div>
        </Card>
      </div>
    </>
  );
}

function useSave(professionalId: string) {
  const queryClient = useQueryClient();
  return (message: string) => ({
    onSuccess: (professional: ProfessionalDTO) => {
      toast.success(message);
      queryClient.setQueryData(adminQueries.professional(professionalId).queryKey, professional);
      queryClient.invalidateQueries({ queryKey: ['admin', 'professionals'], exact: true });
    },
    onError: (e: unknown) => toast.error(errorMessage(e)),
  });
}

function ProfileCard({ professional }: { professional: ProfessionalDTO }) {
  const handlers = useSave(professional.id);
  const [form, setForm] = useState({
    displayName: professional.displayName,
    bio: professional.bio ?? '',
    isActive: professional.isActive,
    canManageBlocks: professional.canManageBlocks,
    canCompleteBookings: professional.canCompleteBookings,
  });
  const save = useMutation({
    mutationFn: () =>
      api<{ professional: ProfessionalDTO }>(`/admin/professionals/${professional.id}`, {
        method: 'PATCH',
        body: form,
      }).then((r) => r.professional),
    ...handlers('Datos guardados'),
  });

  return (
    <Card>
      <CardHeader title="Datos y permisos" />
      <form
        className="flex flex-col gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <TextField
          label="Nombre visible"
          required
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
        />
        <TextAreaField
          label="Presentación"
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
        <SwitchField
          label="Activo"
          description="Si lo desactivas deja de recibir reservas, pero conserva su historial."
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
        />
        <SwitchField
          label="Puede gestionar sus bloqueos"
          checked={form.canManageBlocks}
          onChange={(e) => setForm({ ...form, canManageBlocks: e.target.checked })}
        />
        <SwitchField
          label="Puede completar turnos"
          checked={form.canCompleteBookings}
          onChange={(e) => setForm({ ...form, canCompleteBookings: e.target.checked })}
        />
        <div>
          <Button type="submit" loading={save.isPending}>
            Guardar datos
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ServicesCard({ professional }: { professional: ProfessionalDTO }) {
  const services = useQuery(adminQueries.services());
  const handlers = useSave(professional.id);
  const [selected, setSelected] = useState<string[]>(professional.serviceIds);
  const save = useMutation({
    mutationFn: () =>
      api<{ professional: ProfessionalDTO }>(`/admin/professionals/${professional.id}/services`, {
        method: 'PUT',
        body: { serviceIds: selected },
      }).then((r) => r.professional),
    ...handlers('Servicios asignados'),
  });

  return (
    <Card>
      <CardHeader
        title="Servicios que realiza"
        description="Solo podrá recibir reservas de estos servicios."
      />
      <div className="flex flex-col gap-3 p-5">
        {services.data?.length === 0 && (
          <p className="text-sm text-sand-500">
            Primero{' '}
            <Link to="/admin/servicios" className="font-semibold text-pine-700 hover:underline">
              crea servicios
            </Link>
            .
          </p>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Servicios</legend>
          {services.data?.map((s) => (
            <label
              key={s.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-sand-200 px-3 py-2 hover:bg-sand-50"
            >
              <input
                type="checkbox"
                className="size-4 accent-pine-700"
                checked={selected.includes(s.id)}
                onChange={(e) =>
                  setSelected((cur) =>
                    e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id),
                  )
                }
              />
              <span className="flex-1 text-sm font-semibold">
                {s.name}{' '}
                {!s.isActive && <span className="font-normal text-sand-500">(inactivo)</span>}
              </span>
              <span className="text-xs text-sand-500">{formatDuration(s.durationMinutes)}</span>
            </label>
          ))}
        </fieldset>
        <div>
          <Button
            onClick={() => save.mutate()}
            loading={save.isPending}
            disabled={!services.data?.length}
          >
            Guardar servicios
          </Button>
        </div>
      </div>
    </Card>
  );
}

function HoursSection({ professional }: { professional: ProfessionalDTO }) {
  const handlers = useSave(professional.id);
  const save = useMutation({
    mutationFn: (hours: WorkingHourDTO[]) =>
      api<{ professional: ProfessionalDTO }>(
        `/admin/professionals/${professional.id}/working-hours`,
        {
          method: 'PUT',
          body: { hours },
        },
      ).then((r) => r.professional),
    ...handlers('Horario guardado'),
  });
  return (
    <WorkingHoursEditor
      initial={professional.workingHours}
      saving={save.isPending}
      onSave={(hours) => save.mutate(hours)}
    />
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { centsToAmountString, parseAmountToCents, serviceCreateSchema } from '@turnify/shared';
import { Clock, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { Alert, EmptyState, ErrorState, SkeletonList } from '../../components/ui/Feedback';
import { SelectField, SwitchField, TextAreaField, TextField } from '../../components/ui/Field';
import { api, errorMessage } from '../../lib/api';
import { formatDuration, formatPrice } from '../../lib/format';
import { useApiFormError } from '../auth/useApiForm';
import { adminQueries, type AdminService } from './queries';

const DURATIONS = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240];

/** Form schema: the price is typed as a decimal string and converted to integer cents (RN-018). */
const formSchema = serviceCreateSchema.omit({ priceCents: true }).extend({
  price: z.string().refine((v) => parseAmountToCents(v) !== null, {
    message: 'Ingresa un precio válido (ej.: 1500 o 1500,50)',
  }),
});
type FormValues = z.input<typeof formSchema>;

export function ServicesPage() {
  const { data, isLoading, error, refetch } = useQuery(adminQueries.services());
  const [editing, setEditing] = useState<AdminService | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminService | null>(null);
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: (s: AdminService) =>
      api(`/admin/services/${s.id}`, { method: 'PATCH', body: { isActive: !s.isActive } }),
    onSuccess: (_, s) => {
      toast.success(s.isActive ? 'Servicio desactivado' : 'Servicio activado');
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (s: AdminService) => api(`/admin/services/${s.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Servicio eliminado');
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader
        title="Servicios"
        description="Define qué ofreces, cuánto dura y cuánto cuesta."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            Nuevo servicio
          </Button>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <SkeletonList />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<Tags className="size-6" />}
          title="Todavía no tienes servicios"
          description="Crea tu primer servicio para que tus clientes puedan reservar."
          action={<Button onClick={() => setEditing('new')}>Crear servicio</Button>}
        />
      ) : (
        <ul className="grid gap-3">
          {data.map((s) => (
            <li key={s.id}>
              <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold">{s.name}</h2>
                    {s.isActive ? (
                      <Badge tone="pine">Activo</Badge>
                    ) : (
                      <Badge tone="muted">Inactivo</Badge>
                    )}
                  </div>
                  {s.description && <p className="mt-1 text-sm text-sand-600">{s.description}</p>}
                  <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-sand-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-4" aria-hidden="true" />{' '}
                      {formatDuration(s.durationMinutes)}
                    </span>
                    <span className="font-display text-base font-bold text-sand-900">
                      {formatPrice(s.priceCents)}
                    </span>
                    <span>
                      {s.professionalCount} profesional{s.professionalCount === 1 ? '' : 'es'}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <SwitchField
                    label={s.isActive ? 'Activo' : 'Inactivo'}
                    checked={s.isActive}
                    disabled={toggle.isPending}
                    onChange={() => toggle.mutate(s)}
                    aria-label={`${s.isActive ? 'Desactivar' : 'Activar'} ${s.name}`}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Pencil className="size-4" />}
                    onClick={() => setEditing(s)}
                    aria-label={`Editar ${s.name}`}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-700 hover:bg-red-50"
                    onClick={() => setDeleting(s)}
                    aria-label={`Eliminar ${s.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ServiceFormDialog
          service={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="¿Eliminar servicio?"
        description="Solo se pueden eliminar servicios sin reservas. Si tiene historial, desactívalo para dejar de ofrecerlo."
        confirmLabel="Eliminar"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  );
}

function ServiceFormDialog({
  service,
  onClose,
}: {
  service: AdminService | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: service?.name ?? '',
      description: service?.description ?? '',
      durationMinutes: String(service?.durationMinutes ?? 30),
      price: service ? centsToAmountString(service.priceCents) : '',
      isActive: service?.isActive ?? true,
    },
  });
  const { formError, handleError } = useApiFormError(form.setError);
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ price, ...values }) => {
    const body = { ...values, priceCents: parseAmountToCents(price) };
    try {
      await api(service ? `/admin/services/${service.id}` : '/admin/services', {
        method: service ? 'PATCH' : 'POST',
        body,
      });
      toast.success(service ? 'Servicio actualizado' : 'Servicio creado');
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      onClose();
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={service ? 'Editar servicio' : 'Nuevo servicio'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="service-form" loading={isSubmitting}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="service-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert tone="error">{formError}</Alert>}
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
            label="Duración"
            required
            error={errors.durationMinutes?.message}
            {...form.register('durationMinutes')}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {formatDuration(d)}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Precio (ARS)"
            inputMode="decimal"
            required
            placeholder="15000"
            error={errors.price?.message}
            {...form.register('price')}
          />
        </div>
        <SwitchField
          label="Disponible para reservas"
          description="Los servicios inactivos no aparecen en tu página pública."
          {...form.register('isActive')}
        />
      </form>
    </Dialog>
  );
}

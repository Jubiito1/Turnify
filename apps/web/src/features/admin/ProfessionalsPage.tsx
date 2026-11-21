import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { professionalCreateSchema, type ProfessionalCreateInput } from '@turnify/shared';
import { ChevronRight, KeyRound, Plus, UserRound, Users } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { Alert, EmptyState, ErrorState, SkeletonList } from '../../components/ui/Feedback';
import { SwitchField, TextAreaField, TextField } from '../../components/ui/Field';
import { api } from '../../lib/api';
import { useApiFormError } from '../auth/useApiForm';
import { adminQueries } from './queries';

export function ProfessionalsPage() {
  const { data, isLoading, error, refetch } = useQuery(adminQueries.professionals());
  const services = useQuery(adminQueries.services());
  const [creating, setCreating] = useState(false);
  const serviceName = (id: string) => services.data?.find((s) => s.id === id)?.name;

  return (
    <>
      <PageHeader
        title="Profesionales"
        description="Tu equipo, sus servicios, horarios y permisos."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Nuevo profesional
          </Button>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <SkeletonList />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="Aún no cargaste profesionales"
          description="Agrega a las personas que atienden y asígnales servicios y horarios."
          action={<Button onClick={() => setCreating(true)}>Agregar profesional</Button>}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((p) => (
            <li key={p.id}>
              <Link
                to={`/admin/profesionales/${p.id}`}
                className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-pine-500"
              >
                <Card className="flex h-full items-start gap-4 p-5 transition hover:border-pine-300">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-pine-50 text-pine-700">
                    <UserRound className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold">{p.displayName}</h2>
                      {p.isActive ? (
                        <Badge tone="pine">Activo</Badge>
                      ) : (
                        <Badge tone="muted">Inactivo</Badge>
                      )}
                      {p.account && (
                        <Badge tone="sky">
                          <KeyRound className="size-3" aria-hidden="true" /> Con acceso
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-sand-600">
                      {p.serviceIds.length
                        ? p.serviceIds.map(serviceName).filter(Boolean).join(' · ')
                        : 'Sin servicios asignados'}
                    </p>
                    <p className="mt-1 text-xs text-sand-500">
                      {p.workingHours.length
                        ? `${new Set(p.workingHours.map((h) => h.weekday)).size} días con horario`
                        : 'Sin horario cargado'}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-sand-400" aria-hidden="true" />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {creating && <CreateProfessionalDialog onClose={() => setCreating(false)} />}
    </>
  );
}

function CreateProfessionalDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [withAccount, setWithAccount] = useState(false);
  const form = useForm<ProfessionalCreateInput>({
    resolver: zodResolver(professionalCreateSchema),
    defaultValues: { displayName: '', bio: '', canManageBlocks: false, canCompleteBookings: true },
  });
  const { formError, handleError } = useApiFormError(form.setError);
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const { professional } = await api<{ professional: { id: string } }>('/admin/professionals', {
        method: 'POST',
        body: withAccount ? values : { ...values, account: undefined },
      });
      toast.success('Profesional creado. Ahora asígnale servicios y horario.');
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      onClose();
      navigate(`/admin/profesionales/${professional.id}`);
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Nuevo profesional"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="professional-form" loading={isSubmitting}>
            Crear
          </Button>
        </>
      }
    >
      <form id="professional-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <TextField
          label="Nombre visible"
          required
          error={errors.displayName?.message}
          {...form.register('displayName')}
        />
        <TextAreaField
          label="Presentación (opcional)"
          error={errors.bio?.message}
          {...form.register('bio')}
        />
        <SwitchField label="Puede gestionar sus bloqueos" {...form.register('canManageBlocks')} />
        <SwitchField label="Puede completar turnos" {...form.register('canCompleteBookings')} />
        <SwitchField
          label="Crear acceso al panel profesional"
          description="Podrá ingresar para ver su agenda."
          checked={withAccount}
          onChange={(e) => {
            setWithAccount(e.target.checked);
            if (!e.target.checked) form.setValue('account', undefined);
          }}
        />
        {withAccount && (
          <div className="grid gap-4 rounded-2xl bg-sand-50 p-4 sm:grid-cols-2">
            <TextField
              label="Email de acceso"
              type="email"
              error={errors.account?.email?.message}
              {...form.register('account.email')}
            />
            <TextField
              label="Contraseña inicial"
              type="password"
              autoComplete="new-password"
              error={errors.account?.password?.message}
              {...form.register('account.password')}
            />
          </div>
        )}
      </form>
    </Dialog>
  );
}

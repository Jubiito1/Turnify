import { zodResolver } from '@hookform/resolvers/zod';
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type SessionUser,
  type UpdateProfileInput,
} from '@turnify/shared';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, PageHeader } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Feedback';
import { TextField } from '../../components/ui/Field';
import { api } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { useApiFormError } from '../auth/useApiForm';

export function ProfilePage() {
  const { user, setUser } = useAuth();

  const profile = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    values: { name: user?.name ?? '', phone: user?.phone ?? '' },
  });
  const profileErrors = useApiFormError(profile.setError);

  const password = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const passwordErrors = useApiFormError(password.setError);

  const saveProfile = profile.handleSubmit(async (values) => {
    try {
      const { user: updated } = await api<{ user: SessionUser }>('/auth/me', {
        method: 'PATCH',
        body: values,
      });
      setUser(updated);
      profileErrors.setFormError(null);
      toast.success('Perfil actualizado');
    } catch (error) {
      profileErrors.handleError(error);
    }
  });

  const savePassword = password.handleSubmit(async (values) => {
    try {
      await api('/auth/me/password', { method: 'POST', body: values });
      password.reset();
      passwordErrors.setFormError(null);
      toast.success('Contraseña actualizada');
    } catch (error) {
      passwordErrors.handleError(error);
    }
  });

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title="Mi perfil" description={user.email} />
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader
            title="Datos personales"
            description="Así te verán los negocios cuando reserves."
          />
          <form onSubmit={saveProfile} noValidate className="flex flex-col gap-4 p-5">
            {profileErrors.formError && <Alert tone="error">{profileErrors.formError}</Alert>}
            <TextField
              label="Nombre y apellido"
              required
              error={profile.formState.errors.name?.message}
              {...profile.register('name')}
            />
            <TextField
              label="Teléfono"
              type="tel"
              error={profile.formState.errors.phone?.message}
              {...profile.register('phone')}
            />
            <div>
              <Button type="submit" loading={profile.formState.isSubmitting}>
                Guardar cambios
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="Contraseña"
            description="Usa al menos 8 caracteres con letras y números."
          />
          <form onSubmit={savePassword} noValidate className="flex flex-col gap-4 p-5">
            {passwordErrors.formError && <Alert tone="error">{passwordErrors.formError}</Alert>}
            <TextField
              label="Contraseña actual"
              type="password"
              autoComplete="current-password"
              error={password.formState.errors.currentPassword?.message}
              {...password.register('currentPassword')}
            />
            <TextField
              label="Nueva contraseña"
              type="password"
              autoComplete="new-password"
              error={password.formState.errors.newPassword?.message}
              {...password.register('newPassword')}
            />
            <div>
              <Button type="submit" variant="secondary" loading={password.formState.isSubmitting}>
                Cambiar contraseña
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

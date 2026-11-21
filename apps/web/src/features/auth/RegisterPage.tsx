import { usePageTitle } from '../../lib/usePageTitle';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@turnify/shared';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { TextField } from '../../components/ui/Field';
import { AuthCard } from './AuthCard';
import { homeFor, useAuth } from './AuthProvider';
import { useApiFormError } from './useApiForm';

export function RegisterPage() {
  usePageTitle('Crear cuenta');
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rawNext = params.get('next');
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null;
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', phone: '' },
  });
  const { formError, handleError } = useApiFormError(form.setError);

  if (user) return <Navigate to={next ?? homeFor(user)} replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const created = await register(values);
      navigate(next ?? homeFor(created), { replace: true });
    } catch (error) {
      handleError(error);
    }
  });
  const { errors, isSubmitting } = form.formState;

  return (
    <AuthCard
      title="Crea tu cuenta"
      subtitle="Reserva turnos en segundos y gestiona todas tus citas en un solo lugar."
      footer={
        <div className="flex flex-col gap-2">
          <span>
            ¿Ya tienes cuenta?{' '}
            <Link to="/ingresar" className="font-semibold text-pine-700 hover:underline">
              Ingresa
            </Link>
          </span>
          <span>
            ¿Tienes un negocio?{' '}
            <Link to="/registro-negocio" className="font-semibold text-pine-700 hover:underline">
              Registra tu negocio gratis
            </Link>
          </span>
        </div>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <TextField
          label="Nombre y apellido"
          autoComplete="name"
          required
          error={errors.name?.message}
          {...form.register('name')}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          error={errors.email?.message}
          {...form.register('email')}
        />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          required
          hint="Mínimo 8 caracteres, con al menos una letra y un número."
          error={errors.password?.message}
          {...form.register('password')}
        />
        <TextField
          label="Teléfono (opcional)"
          type="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...form.register('phone')}
        />
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Crear cuenta
        </Button>
      </form>
    </AuthCard>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@turnify/shared';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { TextField } from '../../components/ui/Field';
import { AuthCard } from './AuthCard';
import { homeFor, useAuth } from './AuthProvider';
import { useApiFormError } from './useApiForm';

const DEMO_ACCOUNTS = [
  { label: 'Cliente', email: 'cliente@turnify.demo' },
  { label: 'Administrador', email: 'admin@turnify.demo' },
  { label: 'Profesional', email: 'pro@turnify.demo' },
];

/** Only same-site relative paths are accepted as post-login redirects (no open redirect). */
function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const { formError, handleError } = useApiFormError(form.setError);

  if (user) return <Navigate to={next ?? homeFor(user)} replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const loggedIn = await login(values);
      navigate(next ?? homeFor(loggedIn), { replace: true });
    } catch (error) {
      handleError(error);
    }
  });

  const { errors, isSubmitting } = form.formState;

  return (
    <AuthCard
      title="Hola de nuevo"
      subtitle="Ingresa para gestionar tus turnos."
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link
            to={`/registro${next ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="font-semibold text-pine-700 hover:underline"
          >
            Regístrate
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...form.register('email')}
        />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...form.register('password')}
        />
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Ingresar
        </Button>
      </form>

      <div className="mt-8 rounded-2xl border border-sand-200 bg-sand-100/60 p-4">
        <p className="text-sm font-semibold text-sand-800">Cuentas de demostración</p>
        <p className="mt-0.5 text-xs text-sand-600">
          Contraseña para todas: <code className="font-mono font-semibold">Demo1234</code>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <Button
              key={account.email}
              variant="secondary"
              size="sm"
              onClick={() => {
                form.setValue('email', account.email);
                form.setValue('password', 'Demo1234');
              }}
            >
              {account.label}
            </Button>
          ))}
        </div>
      </div>
    </AuthCard>
  );
}

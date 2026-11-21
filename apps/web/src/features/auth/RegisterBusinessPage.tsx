import { usePageTitle } from '../../lib/usePageTitle';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  BUSINESS_CATEGORIES,
  BUSINESS_CATEGORY_LABELS,
  registerBusinessSchema,
  type RegisterBusinessInput,
} from '@turnify/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { SelectField, TextField } from '../../components/ui/Field';
import { AuthCard } from './AuthCard';
import { homeFor, useAuth } from './AuthProvider';
import { useApiFormError } from './useApiForm';

export const TIMEZONE_OPTIONS = [
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
  { value: 'America/Argentina/Cordoba', label: 'Argentina (Córdoba)' },
  { value: 'America/Argentina/Mendoza', label: 'Argentina (Mendoza)' },
  { value: 'America/Montevideo', label: 'Uruguay (Montevideo)' },
  { value: 'America/Santiago', label: 'Chile (Santiago)' },
  { value: 'America/Sao_Paulo', label: 'Brasil (São Paulo)' },
  { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
  { value: 'America/Mexico_City', label: 'México (Ciudad de México)' },
  { value: 'Europe/Madrid', label: 'España (Madrid)' },
];

/** Business onboarding in two steps: owner account, then business details. */
export function RegisterBusinessPage() {
  usePageTitle('Registrar negocio');
  const { user, registerBusiness } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const form = useForm<RegisterBusinessInput>({
    resolver: zodResolver(registerBusinessSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      businessName: '',
      category: 'BEAUTY',
      timezone: 'America/Argentina/Buenos_Aires',
      address: '',
      phone: '',
    },
  });
  const { formError, handleError } = useApiFormError(form.setError);

  if (user) return <Navigate to={homeFor(user)} replace />;

  const goToStep2 = async () => {
    if (await form.trigger(['name', 'email', 'password'])) setStep(2);
  };

  const onSubmit = form.handleSubmit(
    async (values) => {
      try {
        await registerBusiness(values);
        navigate('/admin?bienvenida=1', { replace: true });
      } catch (error) {
        handleError(error);
        const fieldErrors = form.formState.errors;
        if (fieldErrors.name || fieldErrors.email || fieldErrors.password) setStep(1);
      }
    },
    (errors) => {
      if (errors.name || errors.email || errors.password) setStep(1);
    },
  );
  const { errors, isSubmitting } = form.formState;

  return (
    <AuthCard
      title="Registra tu negocio"
      subtitle={
        <>
          Paso {step} de 2 · {step === 1 ? 'Tu cuenta de administrador' : 'Datos del negocio'}
        </>
      }
      footer={
        <>
          ¿Ya usas Turnify?{' '}
          <Link to="/ingresar" className="font-semibold text-pine-700 hover:underline">
            Ingresa
          </Link>
        </>
      }
    >
      <div className="mb-6 flex gap-2" aria-hidden="true">
        <span className="h-1.5 flex-1 rounded-full bg-pine-600" />
        <span
          className={`h-1.5 flex-1 rounded-full ${step === 2 ? 'bg-pine-600' : 'bg-sand-200'}`}
        />
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        {step === 1 ? (
          <>
            <TextField
              label="Tu nombre"
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
            <Button size="lg" fullWidth onClick={goToStep2}>
              Continuar
            </Button>
          </>
        ) : (
          <>
            <TextField
              label="Nombre del negocio"
              required
              error={errors.businessName?.message}
              {...form.register('businessName')}
            />
            <SelectField
              label="Rubro"
              required
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
              required
              hint="Los horarios de atención se interpretan en esta zona."
              error={errors.timezone?.message}
              {...form.register('timezone')}
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Dirección (opcional)"
              error={errors.address?.message}
              {...form.register('address')}
            />
            <TextField
              label="Teléfono (opcional)"
              type="tel"
              error={errors.phone?.message}
              {...form.register('phone')}
            />
            <div className="flex gap-3">
              <Button variant="secondary" size="lg" onClick={() => setStep(1)}>
                Atrás
              </Button>
              <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
                Crear negocio
              </Button>
            </div>
          </>
        )}
      </form>
    </AuthCard>
  );
}

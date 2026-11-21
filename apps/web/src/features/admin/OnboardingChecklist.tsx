import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Rocket } from 'lucide-react';
import { Link } from 'react-router';
import { Card } from '../../components/ui/Card';
import { adminBusinessQuery } from './AdminLayout';
import { adminQueries } from './queries';

/** Guided setup shown until the business can actually receive bookings. */
export function OnboardingChecklist() {
  const business = useQuery(adminBusinessQuery);
  const services = useQuery(adminQueries.services());
  const professionals = useQuery(adminQueries.professionals());
  if (!services.data || !professionals.data || !business.data) return null;

  const activePros = professionals.data.filter((p) => p.isActive);
  const steps = [
    {
      done: services.data.some((s) => s.isActive),
      label: 'Crea al menos un servicio activo',
      to: '/admin/servicios',
    },
    {
      done: activePros.length > 0,
      label: 'Agrega a tu equipo de profesionales',
      to: '/admin/profesionales',
    },
    {
      done: activePros.some((p) => p.serviceIds.length > 0),
      label: 'Asigna servicios a cada profesional',
      to: '/admin/profesionales',
    },
    {
      done: activePros.some((p) => p.workingHours.length > 0),
      label: 'Carga los horarios de atención',
      to: '/admin/profesionales',
    },
  ];
  if (steps.every((s) => s.done)) return null;
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Card className="mb-6 border-apricot-200 bg-apricot-50/60 p-5">
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-apricot-500 text-pine-950">
          <Rocket className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">Configura tu negocio</h2>
          <p className="text-sm text-sand-700">
            {doneCount} de {steps.length} pasos completos. Cuando termines, tu página{' '}
            <Link
              to={`/negocios/${business.data.slug}`}
              className="font-semibold text-pine-700 hover:underline"
            >
              /negocios/{business.data.slug}
            </Link>{' '}
            empezará a recibir reservas.
          </p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {steps.map((step) => (
              <li key={step.label}>
                <Link
                  to={step.to}
                  className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold hover:bg-sand-50"
                >
                  {step.done ? (
                    <CheckCircle2 className="size-5 text-pine-600" aria-label="Completo" />
                  ) : (
                    <Circle className="size-5 text-sand-400" aria-label="Pendiente" />
                  )}
                  <span className={step.done ? 'text-sand-500 line-through' : 'text-sand-900'}>
                    {step.label}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Card>
  );
}

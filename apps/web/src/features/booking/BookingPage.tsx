import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AvailabilitySlot, BookingDTO } from '@turnify/shared';
import { clsx } from 'clsx';
import { ArrowLeft, CalendarCheck, Check, Clock, UserRound, Users } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { TextAreaField } from '../../components/ui/Field';
import { api, ApiError, errorMessage } from '../../lib/api';
import {
  capitalize,
  formatDuration,
  formatLongDate,
  formatPrice,
  formatTime,
  todayIn,
} from '../../lib/format';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { useAuth } from '../auth/AuthProvider';
import { catalogQueries } from '../catalog/queries';
import { DateStrip } from './DateStrip';
import { SlotPicker } from './SlotPicker';

const ANY = 'cualquiera';
const STEPS = ['Servicio', 'Profesional', 'Fecha y hora', 'Confirmación'];
const SLOT_ERRORS = new Set(['SLOT_TAKEN', 'SLOT_UNAVAILABLE', 'BOOKING_IN_PAST']);

/** Booking wizard. The selection lives in the URL so it survives login/registration redirects. */
export function BookingPage() {
  const { slug = '' } = useParams();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState<BookingDTO | null>(null);

  const serviceId = params.get('servicio');
  const professionalParam = params.get('profesional');
  const date = params.get('fecha');
  const startsAt = params.get('inicio');

  const page = useQuery(catalogQueries.business(slug));
  const business = page.data?.business;
  const service = page.data?.services.find((s) => s.id === serviceId);
  const eligible = useMemo(
    () =>
      page.data?.professionals.filter((p) => serviceId && p.serviceIds.includes(serviceId)) ?? [],
    [page.data, serviceId],
  );
  const professionalId =
    professionalParam && professionalParam !== ANY ? professionalParam : undefined;

  const step = !service ? 0 : !professionalParam ? 1 : !startsAt ? 2 : 3;

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: false });
  };

  const today = business ? todayIn(business.timezone) : '';
  const summary = useQuery({
    ...catalogQueries.summary(slug, {
      serviceId: serviceId ?? '',
      from: today,
      days: 21,
      professionalId,
    }),
    enabled: Boolean(business && service && professionalParam),
  });
  const firstAvailable = summary.data?.days.find((d) => d.slotCount > 0)?.date ?? null;
  const selectedDate = date ?? firstAvailable;

  const availability = useQuery({
    ...catalogQueries.availability(slug, {
      serviceId: serviceId ?? '',
      date: selectedDate ?? '',
      professionalId,
    }),
    enabled: Boolean(business && service && professionalParam && selectedDate),
  });
  const selectedSlot = availability.data?.slots.find((s) => s.startsAt === startsAt) ?? null;

  // A slot chosen from a stale page (or link) that is no longer free sends the user back to step 3.
  useEffect(() => {
    if (step === 3 && availability.data && !selectedSlot && !confirmed) {
      toast.error('Ese horario ya no está disponible. Elige otro.');
      update({ inicio: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, availability.data, selectedSlot, confirmed]);

  const chosenProfessionalId = professionalId ?? selectedSlot?.professionalIds[0];
  const chosenProfessional = page.data?.professionals.find((p) => p.id === chosenProfessionalId);

  const book = useMutation({
    mutationFn: () =>
      api<{ booking: BookingDTO }>('/bookings', {
        method: 'POST',
        body: {
          serviceId,
          professionalId: chosenProfessionalId,
          startsAt,
          notes: notes || undefined,
        },
      }).then((r) => r.booking),
    onSuccess: (booking) => {
      setConfirmed(booking);
      queryClient.invalidateQueries({ queryKey: ['catalog', 'availability'] });
      queryClient.invalidateQueries({ queryKey: ['catalog', 'availability-summary'] });
      queryClient.invalidateQueries({ queryKey: ['client', 'bookings'] });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      if (error instanceof ApiError && SLOT_ERRORS.has(error.code)) {
        queryClient.invalidateQueries({ queryKey: ['catalog'] });
        update({ inicio: null });
      }
    },
  });

  if (page.error instanceof ApiError && page.error.status === 404) return <NotFoundPage />;
  if (page.error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState error={page.error} onRetry={page.refetch} />
      </div>
    );
  }
  if (!page.data || !business) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-14 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-pine-100 text-pine-700">
          <CalendarCheck className="size-8" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-3xl font-extrabold">
          {confirmed.status === 'CONFIRMED' ? '¡Reserva confirmada!' : '¡Reserva registrada!'}
        </h1>
        <p className="mt-2 text-sand-600">
          {confirmed.status === 'CONFIRMED'
            ? 'Te esperamos.'
            : 'El negocio la confirmará a la brevedad. Te avisaremos en tus notificaciones.'}
        </p>
        <Card className="mt-6 p-5 text-left">
          <p className="font-bold">{confirmed.service.name}</p>
          <p className="text-sm text-sand-600">
            {capitalize(formatLongDate(confirmed.startsAt, business.timezone))} ·{' '}
            {formatTime(confirmed.startsAt, business.timezone)} a{' '}
            {formatTime(confirmed.endsAt, business.timezone)}
          </p>
          <p className="text-sm text-sand-600">
            Con {confirmed.professional.displayName} · {business.name}
          </p>
        </Card>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link
            to="/mis-reservas"
            className="rounded-xl bg-pine-700 px-5 py-2.5 font-semibold text-white hover:bg-pine-800"
          >
            Ver mis reservas
          </Link>
          <Link
            to={`/negocios/${business.slug}`}
            className="rounded-xl border border-sand-300 bg-white px-5 py-2.5 font-semibold text-sand-800 hover:bg-sand-100"
          >
            Volver al negocio
          </Link>
        </div>
      </div>
    );
  }

  const nextUrl = encodeURIComponent(location.pathname + location.search);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <Link
        to={`/negocios/${business.slug}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-sand-600 hover:text-sand-900"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> {business.name}
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold">Reservar turno</h1>

      <ol className="mt-6 flex gap-2" aria-label="Pasos de la reserva">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1" aria-current={i === step ? 'step' : undefined}>
            <span
              className={clsx(
                'block h-1.5 rounded-full',
                i <= step ? 'bg-pine-600' : 'bg-sand-200',
              )}
            />
            <span
              className={clsx(
                'mt-2 hidden text-xs font-semibold sm:block',
                i === step ? 'text-pine-800' : 'text-sand-500',
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-col gap-6">
        {/* Step 1: service */}
        <StepCard
          title="1. Servicio"
          done={step > 0}
          onEdit={() => update({ servicio: null, profesional: null, fecha: null, inicio: null })}
          summary={
            service &&
            `${service.name} · ${formatDuration(service.durationMinutes)} · ${formatPrice(service.priceCents)}`
          }
        >
          {step === 0 && (
            <ul className="grid gap-2">
              {page.data.services
                .filter((s) => page.data.professionals.some((p) => p.serviceIds.includes(s.id)))
                .map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => update({ servicio: s.id })}
                      className="flex w-full items-center justify-between rounded-xl border border-sand-300 bg-white px-4 py-3 text-left hover:border-pine-400 hover:bg-pine-50"
                    >
                      <span>
                        <span className="block font-semibold">{s.name}</span>
                        <span className="text-sm text-sand-500">
                          {formatDuration(s.durationMinutes)}
                        </span>
                      </span>
                      <span className="font-display font-bold">{formatPrice(s.priceCents)}</span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </StepCard>

        {/* Step 2: professional */}
        {step >= 1 && (
          <StepCard
            title="2. Profesional"
            done={step > 1}
            onEdit={() => update({ profesional: null, fecha: null, inicio: null })}
            summary={
              professionalParam === ANY
                ? 'Cualquier profesional disponible'
                : eligible.find((p) => p.id === professionalParam)?.displayName
            }
          >
            {step === 1 && (
              <div className="grid gap-2 sm:grid-cols-2">
                <ChoiceButton
                  icon={<Users className="size-5" />}
                  title="Cualquiera disponible"
                  subtitle="Más horarios para elegir"
                  onClick={() => update({ profesional: ANY })}
                />
                {eligible.map((p) => (
                  <ChoiceButton
                    key={p.id}
                    icon={<UserRound className="size-5" />}
                    title={p.displayName}
                    subtitle={p.bio ?? undefined}
                    onClick={() => update({ profesional: p.id })}
                  />
                ))}
              </div>
            )}
          </StepCard>
        )}

        {/* Step 3: date and time */}
        {step >= 2 && (
          <StepCard
            title="3. Fecha y hora"
            done={step > 2}
            onEdit={() => update({ inicio: null })}
            summary={
              selectedSlot &&
              `${capitalize(formatLongDate(selectedSlot.startsAt, business.timezone))} · ${formatTime(selectedSlot.startsAt, business.timezone)}`
            }
          >
            {step === 2 && (
              <div className="flex flex-col gap-5">
                {summary.isLoading ? (
                  <Skeleton className="h-20" />
                ) : summary.error ? (
                  <ErrorState error={summary.error} onRetry={summary.refetch} />
                ) : !firstAvailable ? (
                  <EmptyState
                    title="No hay horarios disponibles"
                    description="Prueba con otro profesional o vuelve más adelante."
                  />
                ) : (
                  <>
                    <DateStrip
                      days={summary.data!.days}
                      timezone={business.timezone}
                      selected={selectedDate}
                      onSelect={(d) => update({ fecha: d, inicio: null })}
                    />
                    {selectedDate && (
                      <div>
                        <p className="mb-3 font-semibold">
                          {capitalize(
                            formatLongDate(`${selectedDate}T12:00:00`, business.timezone),
                          )}
                        </p>
                        {availability.isLoading ? (
                          <Skeleton className="h-32" />
                        ) : availability.error ? (
                          <ErrorState error={availability.error} onRetry={availability.refetch} />
                        ) : availability.data && availability.data.slots.length > 0 ? (
                          <SlotPicker
                            slots={availability.data.slots}
                            timezone={business.timezone}
                            selected={startsAt}
                            onSelect={(slot: AvailabilitySlot) =>
                              update({ fecha: selectedDate, inicio: slot.startsAt })
                            }
                          />
                        ) : (
                          <p className="text-sm text-sand-500">
                            No quedan horarios libres este día.
                          </p>
                        )}
                      </div>
                    )}
                    <p className="flex items-center gap-1.5 text-xs text-sand-500">
                      <Clock className="size-3.5" aria-hidden="true" /> Horarios en la hora local
                      del negocio.
                    </p>
                  </>
                )}
              </div>
            )}
          </StepCard>
        )}

        {/* Step 4: confirmation */}
        {step === 3 && selectedSlot && service && (
          <Card className="p-5 sm:p-6">
            <h2 className="text-lg font-bold">4. Confirma tu reserva</h2>
            <dl className="mt-4 grid gap-3 rounded-2xl bg-sand-50 p-4 text-sm sm:grid-cols-2">
              <Detail label="Servicio" value={service.name} />
              <Detail label="Profesional" value={chosenProfessional?.displayName ?? '—'} />
              <Detail
                label="Fecha"
                value={capitalize(formatLongDate(selectedSlot.startsAt, business.timezone))}
              />
              <Detail
                label="Horario"
                value={`${formatTime(selectedSlot.startsAt, business.timezone)} a ${formatTime(selectedSlot.endsAt, business.timezone)}`}
              />
              <Detail label="Precio" value={formatPrice(service.priceCents)} />
              <Detail label="Lugar" value={business.address ?? business.name} />
            </dl>

            {!user ? (
              <div className="mt-5 rounded-2xl border border-pine-200 bg-pine-50 p-4">
                <p className="font-semibold text-pine-900">Ingresa para confirmar la reserva</p>
                <p className="mt-1 text-sm text-pine-800">
                  Guardamos tu selección: volverás a este paso.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to={`/ingresar?next=${nextUrl}`}
                    className="rounded-xl bg-pine-700 px-4 py-2 text-sm font-semibold text-white hover:bg-pine-800"
                  >
                    Ingresar
                  </Link>
                  <Link
                    to={`/registro?next=${nextUrl}`}
                    className="rounded-xl border border-pine-300 bg-white px-4 py-2 text-sm font-semibold text-pine-800 hover:bg-pine-100"
                  >
                    Crear cuenta
                  </Link>
                </div>
              </div>
            ) : user.role !== 'CLIENT' ? (
              <Alert tone="warning" className="mt-5">
                Estás usando una cuenta de {user.role === 'ADMIN' ? 'administrador' : 'profesional'}
                . Para reservar, ingresa con una cuenta de cliente.
              </Alert>
            ) : (
              <form
                className="mt-5 flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  book.mutate();
                }}
              >
                <TextAreaField
                  label="Notas para el negocio (opcional)"
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  hint={`Cancelación gratuita hasta ${business.cancellationMinHours} h antes del turno.`}
                />
                <Button
                  type="submit"
                  size="lg"
                  variant="accent"
                  loading={book.isPending}
                  icon={<Check className="size-5" />}
                >
                  Confirmar reserva
                </Button>
              </form>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function StepCard({
  title,
  done,
  summary,
  onEdit,
  children,
}: {
  title: string;
  done: boolean;
  summary?: string | null | false;
  onEdit: () => void;
  children?: ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={clsx('text-lg font-bold', done && 'text-sand-500')}>{title}</h2>
          {done && summary && (
            <p className="mt-0.5 truncate font-semibold text-sand-900">{summary}</p>
          )}
        </div>
        {done && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Cambiar
          </Button>
        )}
      </div>
      {!done && children && <div className="mt-4">{children}</div>}
    </Card>
  );
}

function ChoiceButton({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 rounded-xl border border-sand-300 bg-white p-4 text-left hover:border-pine-400 hover:bg-pine-50"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pine-50 text-pine-700">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        {subtitle && <span className="line-clamp-2 text-sm text-sand-500">{subtitle}</span>}
      </span>
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-sand-500 uppercase">{label}</dt>
      <dd className="font-semibold text-sand-900">{value}</dd>
    </div>
  );
}

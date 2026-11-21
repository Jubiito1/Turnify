import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BOOKING_TRANSITIONS, type BookingDTO, type BookingStatus } from '@turnify/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { TextField } from '../../components/ui/Field';
import { api, errorMessage } from '../../lib/api';
import { capitalize, formatLongDate, formatPrice, formatTime } from '../../lib/format';
import { RescheduleDialog } from '../account/RescheduleDialog';

const ACTION_LABEL: Record<BookingStatus, string> = {
  CONFIRMED: 'Confirmar',
  COMPLETED: 'Marcar completada',
  CANCELLED: 'Cancelar reserva',
  NO_SHOW: 'Marcar ausente',
  PENDING: 'Pendiente',
};

/**
 * Booking details with the status actions allowed by the transition table (RN-015). Completion and
 * no-show only appear once the appointment started (RN-026); the API enforces both regardless.
 */
export function BookingDetailDialog({
  booking,
  onClose,
  statusEndpoint = (id: string) => `/admin/bookings/${id}/status`,
  rescheduleEndpoint = (id: string) => `/admin/bookings/${id}/reschedule`,
  allowedActions,
}: {
  booking: BookingDTO;
  onClose: () => void;
  statusEndpoint?: (id: string) => string;
  rescheduleEndpoint?: ((id: string) => string) | null;
  allowedActions?: BookingStatus[];
}) {
  const tz = booking.business.timezone;
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const started = new Date(booking.startsAt).getTime() <= Date.now();

  const actions = BOOKING_TRANSITIONS[booking.status].filter(
    (to) =>
      (allowedActions ? allowedActions.includes(to) : true) &&
      ((to !== 'COMPLETED' && to !== 'NO_SHOW') || started),
  );

  const change = useMutation({
    mutationFn: (status: BookingStatus) =>
      api(statusEndpoint(booking.id), {
        method: 'PATCH',
        body: { status, reason: status === 'CANCELLED' && reason ? reason : undefined },
      }),
    onSuccess: (_, status) => {
      toast.success(status === 'CANCELLED' ? 'Reserva cancelada' : 'Estado actualizado');
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['pro'] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const canReschedule =
    rescheduleEndpoint &&
    (booking.status === 'PENDING' || booking.status === 'CONFIRMED') &&
    !started;

  return (
    <>
      <Dialog
        open={!rescheduling}
        onOpenChange={(open) => !open && onClose()}
        title={booking.service.name}
        description={`${capitalize(formatLongDate(booking.startsAt, tz))} · ${formatTime(booking.startsAt, tz)} a ${formatTime(booking.endsAt, tz)}`}
        footer={
          <>
            {canReschedule && (
              <Button variant="secondary" onClick={() => setRescheduling(true)}>
                Reprogramar
              </Button>
            )}
            {actions.map((to) => (
              <Button
                key={to}
                variant={to === 'CANCELLED' ? 'danger' : to === 'NO_SHOW' ? 'secondary' : 'primary'}
                loading={change.isPending && change.variables === to}
                disabled={change.isPending}
                onClick={() => change.mutate(to)}
              >
                {ACTION_LABEL[to]}
              </Button>
            ))}
          </>
        }
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Item label="Estado" value={<StatusBadge status={booking.status} />} />
          <Item label="Profesional" value={booking.professional.displayName} />
          <Item label="Cliente" value={booking.client.name} />
          <Item
            label="Contacto"
            value={[booking.client.email, booking.client.phone].filter(Boolean).join(' · ')}
          />
          <Item label="Precio" value={formatPrice(booking.priceCents)} />
          {booking.notes && <Item label="Notas" value={booking.notes} />}
          {booking.cancellationReason && (
            <Item label="Motivo de cancelación" value={booking.cancellationReason} />
          )}
        </dl>
        {actions.includes('CANCELLED') && (
          <TextField
            containerClassName="mt-4"
            label="Motivo de cancelación (opcional)"
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
        {!actions.length && !canReschedule && (
          <p className="mt-4 text-sm text-sand-500">
            No hay acciones disponibles para esta reserva.
          </p>
        )}
      </Dialog>
      {rescheduling && rescheduleEndpoint && (
        <RescheduleDialog
          booking={booking}
          open
          onOpenChange={(open) => {
            if (!open) {
              setRescheduling(false);
            }
          }}
          endpoint={rescheduleEndpoint(booking.id)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: ['admin'] });
            onClose();
          }}
        />
      )}
    </>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-sand-500 uppercase">{label}</dt>
      <dd className="mt-0.5 font-medium text-sand-900">{value}</dd>
    </div>
  );
}

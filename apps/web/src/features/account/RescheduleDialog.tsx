import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BookingDTO } from '@turnify/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { api, errorMessage } from '../../lib/api';
import { capitalize, formatLongDate, formatTime, todayIn } from '../../lib/format';
import { DateStrip } from '../booking/DateStrip';
import { SlotPicker } from '../booking/SlotPicker';
import { catalogQueries } from '../catalog/queries';

interface RescheduleDialogProps {
  booking: BookingDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** API path that performs the reschedule (client or admin endpoint). */
  endpoint: string;
  onDone?: (booking: BookingDTO) => void;
}

/** Picks a new free slot (same service and professional) using the real availability engine (RN-016). */
export function RescheduleDialog({
  booking,
  open,
  onOpenChange,
  endpoint,
  onDone,
}: RescheduleDialogProps) {
  const tz = booking.business.timezone;
  const queryClient = useQueryClient();
  const [date, setDate] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const params = { serviceId: booking.service.id, professionalId: booking.professional.id };

  const summary = useQuery({
    ...catalogQueries.summary(booking.business.slug, { ...params, from: todayIn(tz), days: 21 }),
    enabled: open,
  });
  const firstAvailable = summary.data?.days.find((d) => d.slotCount > 0)?.date ?? null;
  const selectedDate = date ?? firstAvailable;
  const slots = useQuery({
    ...catalogQueries.availability(booking.business.slug, { ...params, date: selectedDate ?? '' }),
    enabled: open && Boolean(selectedDate),
  });

  const mutation = useMutation({
    mutationFn: () =>
      api<{ booking: BookingDTO }>(endpoint, { method: 'POST', body: { startsAt } }).then(
        (r) => r.booking,
      ),
    onSuccess: (updated) => {
      toast.success('Turno reprogramado');
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      onDone?.(updated);
      onOpenChange(false);
      setStartsAt(null);
      setDate(null);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      setStartsAt(null);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Reprogramar turno"
      description={`${booking.service.name} con ${booking.professional.displayName}. Actual: ${capitalize(formatLongDate(booking.startsAt, tz))}, ${formatTime(booking.startsAt, tz)}.`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!startsAt}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {startsAt ? `Mover a las ${formatTime(startsAt, tz)}` : 'Elige un horario'}
          </Button>
        </>
      }
    >
      {summary.isLoading ? (
        <Skeleton className="h-24" />
      ) : summary.error ? (
        <ErrorState error={summary.error} onRetry={summary.refetch} />
      ) : !firstAvailable ? (
        <EmptyState
          title="No hay horarios libres"
          description="No encontramos horarios en las próximas semanas."
        />
      ) : (
        <div className="flex flex-col gap-5">
          <DateStrip
            days={summary.data!.days}
            timezone={tz}
            selected={selectedDate}
            onSelect={(d) => {
              setDate(d);
              setStartsAt(null);
            }}
          />
          {slots.isLoading ? (
            <Skeleton className="h-28" />
          ) : slots.data && slots.data.slots.length > 0 ? (
            <SlotPicker
              slots={slots.data.slots}
              timezone={tz}
              selected={startsAt}
              onSelect={(s) => setStartsAt(s.startsAt)}
            />
          ) : (
            <p className="text-sm text-sand-500">No quedan horarios este día.</p>
          )}
          {booking.status === 'CONFIRMED' && (
            <Alert tone="info">
              Si el negocio no confirma automáticamente, el turno volverá a quedar pendiente de
              confirmación.
            </Alert>
          )}
        </div>
      )}
    </Dialog>
  );
}

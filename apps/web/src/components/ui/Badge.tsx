import { clsx } from 'clsx';
import { BOOKING_STATUS_LABELS, type BookingStatus } from '@turnify/shared';
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'pine' | 'apricot' | 'sky' | 'rose' | 'muted';

const tones: Record<Tone, string> = {
  neutral: 'bg-sand-100 text-sand-700 ring-sand-200',
  pine: 'bg-pine-50 text-pine-800 ring-pine-200',
  apricot: 'bg-apricot-50 text-apricot-700 ring-apricot-200',
  sky: 'bg-sky-50 text-sky-800 ring-sky-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  muted: 'bg-sand-50 text-sand-500 ring-sand-200',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<BookingStatus, Tone> = {
  PENDING: 'apricot',
  CONFIRMED: 'pine',
  COMPLETED: 'sky',
  CANCELLED: 'muted',
  NO_SHOW: 'rose',
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {BOOKING_STATUS_LABELS[status]}
    </Badge>
  );
}

import { clsx } from 'clsx';
import { AlertTriangle, Inbox, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { errorMessage } from '../../lib/api';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={clsx('animate-pulse rounded-lg bg-sand-200/70', className)}
    />
  );
}

/** Placeholder list while data loads. */
export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={clsx('flex flex-col gap-3', className)} role="status" aria-label="Cargando">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-sand-300 bg-sand-50 px-6 py-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-pine-50 text-pine-600">
        {icon ?? <Inbox className="size-6" aria-hidden="true" />}
      </div>
      <h3 className="text-base font-bold text-sand-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-sand-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center"
    >
      <AlertTriangle className="size-7 text-red-500" aria-hidden="true" />
      <div>
        <p className="font-semibold text-red-800">No pudimos cargar la información</p>
        <p className="mt-1 text-sm text-red-700">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          icon={<RotateCw className="size-4" />}
        >
          Reintentar
        </Button>
      )}
    </div>
  );
}

export function Alert({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'info' | 'warning' | 'error' | 'success';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'border-pine-200 bg-pine-50 text-pine-900',
    success: 'border-pine-300 bg-pine-50 text-pine-900',
    warning: 'border-apricot-200 bg-apricot-50 text-apricot-700',
    error: 'border-red-200 bg-red-50 text-red-800',
  };
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={clsx('rounded-xl border px-4 py-3 text-sm', tones[tone], className)}
    >
      {children}
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationDTO } from '@turnify/shared';
import { clsx } from 'clsx';
import { Bell, CheckCheck } from 'lucide-react';
import { DateTime } from 'luxon';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../auth/AuthProvider';

interface NotificationsResponse {
  unreadCount: number;
  items: NotificationDTO[];
}

export const notificationsKey = ['notifications'] as const;

function relative(iso: string): string {
  return DateTime.fromISO(iso).setLocale('es').toRelative() ?? '';
}

/** In-app notification center with unread badge; polls every minute while signed in. */
export function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: notificationsKey,
    queryFn: () => api<NotificationsResponse>('/notifications'),
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: notificationsKey });
  const markRead = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: invalidate,
  });
  const markAll = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST' }),
    onSuccess: invalidate,
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  const unread = data?.unreadCount ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl p-2 text-sand-700 hover:bg-sand-100"
      >
        <Bell className="size-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-apricot-500 px-1 text-[10px] font-bold text-pine-950">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="region"
          aria-label="Notificaciones"
          className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-pop animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-sand-100 px-4 py-3">
            <p className="font-semibold">Notificaciones</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-pine-700 hover:underline"
              >
                <CheckCheck className="size-4" aria-hidden="true" /> Marcar todas como leídas
              </button>
            )}
          </div>
          {!data?.items.length ? (
            <p className="px-4 py-8 text-center text-sm text-sand-500">No tienes notificaciones.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-sand-100 overflow-y-auto">
              {data.items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => !n.readAt && markRead.mutate(n.id)}
                    className={clsx(
                      'flex w-full gap-3 px-4 py-3 text-left hover:bg-sand-50',
                      !n.readAt && 'bg-pine-50/40',
                    )}
                  >
                    <span
                      className={clsx(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        n.readAt ? 'bg-transparent' : 'bg-apricot-500',
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-sand-900">
                        {n.title}
                        {!n.readAt && <span className="sr-only"> (sin leer)</span>}
                      </span>
                      <span className="block text-sm text-sand-600">{n.body}</span>
                      <span className="mt-0.5 block text-xs text-sand-400">
                        {relative(n.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import type { BusinessDetail } from '@turnify/shared';
import {
  CalendarDays,
  CalendarOff,
  LayoutDashboard,
  ListChecks,
  Settings,
  Tags,
  Users,
  UsersRound,
} from 'lucide-react';
import { api } from '../../lib/api';
import { PanelLayout, type PanelNavItem } from '../../layouts/PanelLayout';

export const ADMIN_NAV: PanelNavItem[] = [
  { to: '/admin', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/admin/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/admin/reservas', label: 'Reservas', icon: ListChecks },
  { to: '/admin/servicios', label: 'Servicios', icon: Tags },
  { to: '/admin/profesionales', label: 'Profesionales', icon: Users },
  { to: '/admin/bloqueos', label: 'Bloqueos', icon: CalendarOff },
  { to: '/admin/clientes', label: 'Clientes', icon: UsersRound },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings },
];

export const adminBusinessQuery = {
  queryKey: ['admin', 'business'] as const,
  queryFn: () => api<{ business: BusinessDetail }>('/admin/business').then((r) => r.business),
};

export function AdminLayout() {
  const { data: business } = useQuery(adminBusinessQuery);
  return (
    <PanelLayout
      nav={ADMIN_NAV}
      title={business?.name ?? 'Mi negocio'}
      subtitle="Panel de administración"
    />
  );
}

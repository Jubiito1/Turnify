import { useQuery } from '@tanstack/react-query';
import type { BusinessDetail } from '@turnify/shared';
import { LayoutDashboard, Tags, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { PanelLayout, type PanelNavItem } from '../../layouts/PanelLayout';

export const ADMIN_NAV: PanelNavItem[] = [
  { to: '/admin', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/admin/servicios', label: 'Servicios', icon: Tags },
  { to: '/admin/profesionales', label: 'Profesionales', icon: Users },
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

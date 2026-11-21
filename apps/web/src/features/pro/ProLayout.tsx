import { useQuery } from '@tanstack/react-query';
import type { ProfessionalProfileDTO } from '@turnify/shared';
import { CalendarDays } from 'lucide-react';
import { api } from '../../lib/api';
import { PanelLayout, type PanelNavItem } from '../../layouts/PanelLayout';

export const PRO_NAV: PanelNavItem[] = [
  { to: '/pro', label: 'Mi agenda', icon: CalendarDays, end: true },
];

export const proProfileQuery = {
  queryKey: ['pro', 'me'] as const,
  queryFn: () =>
    api<{ professional: ProfessionalProfileDTO }>('/pro/me').then((r) => r.professional),
};

export function ProLayout() {
  const { data: profile } = useQuery(proProfileQuery);
  return (
    <PanelLayout
      nav={PRO_NAV}
      title={profile?.displayName ?? 'Panel profesional'}
      subtitle={profile?.business.name}
    />
  );
}

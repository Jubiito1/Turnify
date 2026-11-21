import { queryOptions } from '@tanstack/react-query';
import type { ProfessionalDTO, ServiceDTO } from '@turnify/shared';
import { api } from '../../lib/api';

export type AdminService = ServiceDTO & { professionalCount: number };

export const adminQueries = {
  services: () =>
    queryOptions({
      queryKey: ['admin', 'services'],
      queryFn: () => api<{ items: AdminService[] }>('/admin/services').then((r) => r.items),
    }),
  professionals: () =>
    queryOptions({
      queryKey: ['admin', 'professionals'],
      queryFn: () => api<{ items: ProfessionalDTO[] }>('/admin/professionals').then((r) => r.items),
    }),
  professional: (id: string) =>
    queryOptions({
      queryKey: ['admin', 'professionals', id],
      queryFn: () =>
        api<{ professional: ProfessionalDTO }>(`/admin/professionals/${id}`).then(
          (r) => r.professional,
        ),
    }),
};

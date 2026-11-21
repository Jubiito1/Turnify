import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import type {
  AvailabilityResponse,
  AvailabilitySummaryResponse,
  BusinessCategory,
  BusinessDetail,
  BusinessSummary,
  Paginated,
  ProfessionalPublicDTO,
  ServiceDTO,
} from '@turnify/shared';
import { api } from '../../lib/api';

export interface BusinessPage {
  business: BusinessDetail;
  services: ServiceDTO[];
  professionals: ProfessionalPublicDTO[];
}

export const catalogQueries = {
  list: (params: { q?: string; category?: BusinessCategory; page?: number; pageSize?: number }) =>
    queryOptions({
      queryKey: ['catalog', 'list', params],
      queryFn: () => api<Paginated<BusinessSummary>>('/businesses', { query: params }),
      placeholderData: keepPreviousData,
    }),
  business: (slug: string) =>
    queryOptions({
      queryKey: ['catalog', 'business', slug],
      queryFn: () => api<BusinessPage>(`/businesses/${slug}`),
    }),
  summary: (
    slug: string,
    params: { serviceId: string; from: string; days: number; professionalId?: string },
  ) =>
    queryOptions({
      queryKey: ['catalog', 'availability-summary', slug, params],
      queryFn: () =>
        api<AvailabilitySummaryResponse>(`/businesses/${slug}/availability/summary`, {
          query: params,
        }),
    }),
  availability: (
    slug: string,
    params: { serviceId: string; date: string; professionalId?: string },
  ) =>
    queryOptions({
      queryKey: ['catalog', 'availability', slug, params],
      queryFn: () =>
        api<AvailabilityResponse>(`/businesses/${slug}/availability`, { query: params }),
      staleTime: 0,
    }),
};

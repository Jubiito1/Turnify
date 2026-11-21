import type {
  AvailabilityResponse,
  BookingDTO,
  BusinessDetail,
  BusinessSummary,
  ProfessionalPublicDTO,
  ServiceDTO,
} from '@turnify/shared';

export const TZ = 'America/Argentina/Buenos_Aires';

export const business: BusinessDetail = {
  id: 'b0000000-0000-4000-8000-000000000001',
  name: 'Estudio Lumen',
  slug: 'estudio-lumen',
  category: 'BEAUTY',
  description: 'Peluquería y estética integral.',
  address: 'Gurruchaga 1450, Palermo',
  phone: '+54 11 4833-1450',
  timezone: TZ,
  cancellationMinHours: 12,
  slotIntervalMinutes: 15,
  bookingHorizonDays: 60,
  autoConfirm: false,
};

export const businessSummary: BusinessSummary = {
  id: business.id,
  name: business.name,
  slug: business.slug,
  category: business.category,
  description: business.description,
  address: business.address,
  timezone: TZ,
  serviceCount: 2,
  minPriceCents: 900000,
};

export const services: ServiceDTO[] = [
  {
    id: 's0000000-0000-4000-8000-000000000001',
    name: 'Corte y peinado',
    description: 'Lavado, corte y peinado.',
    durationMinutes: 45,
    priceCents: 1800000,
    isActive: true,
  },
  {
    id: 's0000000-0000-4000-8000-000000000002',
    name: 'Brushing',
    description: null,
    durationMinutes: 30,
    priceCents: 900000,
    isActive: true,
  },
];

export const professionals: ProfessionalPublicDTO[] = [
  {
    id: 'p0000000-0000-4000-8000-000000000001',
    displayName: 'Lucía Fernández',
    bio: 'Colorista',
    serviceIds: [services[0]!.id, services[1]!.id],
  },
  {
    id: 'p0000000-0000-4000-8000-000000000002',
    displayName: 'Martín Paz',
    bio: null,
    serviceIds: [services[0]!.id],
  },
];

/** 2030-01-07 is a Monday; 12:00Z = 09:00 in Buenos Aires. */
export const availability: AvailabilityResponse = {
  date: '2030-01-07',
  timezone: TZ,
  serviceId: services[0]!.id,
  durationMinutes: 45,
  slots: [
    {
      startsAt: '2030-01-07T12:00:00.000Z',
      endsAt: '2030-01-07T12:45:00.000Z',
      professionalIds: [professionals[0]!.id, professionals[1]!.id],
    },
    {
      startsAt: '2030-01-07T12:15:00.000Z',
      endsAt: '2030-01-07T13:00:00.000Z',
      professionalIds: [professionals[1]!.id],
    },
    {
      startsAt: '2030-01-07T18:00:00.000Z',
      endsAt: '2030-01-07T18:45:00.000Z',
      professionalIds: [professionals[0]!.id],
    },
  ],
};

export function booking(overrides: Partial<BookingDTO> = {}): BookingDTO {
  return {
    id: 'k0000000-0000-4000-8000-000000000001',
    status: 'PENDING',
    startsAt: '2030-01-07T12:00:00.000Z',
    endsAt: '2030-01-07T12:45:00.000Z',
    priceCents: 1800000,
    notes: null,
    cancellationReason: null,
    cancelledAt: null,
    createdAt: '2029-12-30T10:00:00.000Z',
    service: { id: services[0]!.id, name: services[0]!.name, durationMinutes: 45 },
    professional: { id: professionals[0]!.id, displayName: professionals[0]!.displayName },
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      timezone: TZ,
      cancellationMinHours: 12,
    },
    client: { id: 'c1', name: 'Juan Pérez', email: 'cliente@turnify.demo', phone: null },
    ...overrides,
  };
}

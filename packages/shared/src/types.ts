import type { BookingStatus, BusinessCategory, NotificationType, Role } from './enums';

/** API response DTOs shared by the API and the web client. Dates are ISO-8601 strings. */

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  businessId: string | null;
  professionalId: string | null;
}

export interface BusinessSummary {
  id: string;
  name: string;
  slug: string;
  category: BusinessCategory;
  description: string | null;
  address: string | null;
  timezone: string;
  serviceCount: number;
  minPriceCents: number | null;
}

export interface BusinessDetail extends Omit<BusinessSummary, 'serviceCount' | 'minPriceCents'> {
  phone: string | null;
  cancellationMinHours: number;
  slotIntervalMinutes: number;
  bookingHorizonDays: number;
  autoConfirm: boolean;
}

export interface ServiceDTO {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  isActive: boolean;
}

export interface WorkingHourDTO {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface ProfessionalPublicDTO {
  id: string;
  displayName: string;
  bio: string | null;
  serviceIds: string[];
}

export interface ProfessionalDTO extends ProfessionalPublicDTO {
  isActive: boolean;
  canManageBlocks: boolean;
  canCompleteBookings: boolean;
  account: { email: string } | null;
  workingHours: WorkingHourDTO[];
}

export interface AvailabilitySlot {
  startsAt: string;
  endsAt: string;
  professionalIds: string[];
}

export interface AvailabilityResponse {
  date: string;
  timezone: string;
  serviceId: string;
  durationMinutes: number;
  slots: AvailabilitySlot[];
}

export interface TimeBlockDTO {
  id: string;
  professionalId: string;
  professionalName: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

export interface BookingDTO {
  id: string;
  status: BookingStatus;
  startsAt: string;
  endsAt: string;
  priceCents: number;
  notes: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  service: { id: string; name: string; durationMinutes: number };
  professional: { id: string; displayName: string };
  business: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    cancellationMinHours: number;
  };
  client: { id: string; name: string; email: string; phone: string | null };
}

export interface ClientSummaryDTO {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  totalBookings: number;
  completedBookings: number;
  lastBookingAt: string | null;
}

export interface StatsDTO {
  range: { from: string; to: string };
  totals: {
    bookings: number;
    active: number;
    completed: number;
    cancelled: number;
    noShow: number;
    revenueCents: number;
    expectedRevenueCents: number;
    uniqueClients: number;
    cancellationRate: number;
    occupancyRate: number;
  };
  byService: {
    serviceId: string;
    name: string;
    bookings: number;
    completed: number;
    revenueCents: number;
  }[];
  byProfessional: {
    professionalId: string;
    name: string;
    bookings: number;
    completed: number;
    revenueCents: number;
    bookedMinutes: number;
    availableMinutes: number;
  }[];
  byDay: { date: string; bookings: number; revenueCents: number }[];
}

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  bookingId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AvailabilitySummaryResponse {
  timezone: string;
  serviceId: string;
  days: { date: string; slotCount: number }[];
}

export interface ProfessionalProfileDTO {
  id: string;
  displayName: string;
  bio: string | null;
  canManageBlocks: boolean;
  canCompleteBookings: boolean;
  business: { id: string; name: string; slug: string; timezone: string };
  workingHours: WorkingHourDTO[];
}

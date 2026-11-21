export const ROLES = ['CLIENT', 'PROFESSIONAL', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Statuses that occupy a professional's (and client's) time. RN-012 */
export const ACTIVE_BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
] as const satisfies readonly BookingStatus[];

export function isActiveStatus(status: BookingStatus): boolean {
  return (ACTIVE_BOOKING_STATUSES as readonly BookingStatus[]).includes(status);
}

export const BUSINESS_CATEGORIES = [
  'BEAUTY',
  'BARBERSHOP',
  'HEALTH',
  'WELLNESS',
  'FITNESS',
  'EDUCATION',
  'PETS',
  'OTHER',
] as const;
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

export const BUSINESS_CATEGORY_LABELS: Record<BusinessCategory, string> = {
  BEAUTY: 'Belleza y estética',
  BARBERSHOP: 'Barbería',
  HEALTH: 'Salud',
  WELLNESS: 'Bienestar y spa',
  FITNESS: 'Deporte y fitness',
  EDUCATION: 'Clases y educación',
  PETS: 'Mascotas',
  OTHER: 'Otros',
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'Ausente',
};

export const NOTIFICATION_TYPES = [
  'BOOKING_CREATED',
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'BOOKING_RESCHEDULED',
  'BOOKING_COMPLETED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const WEEKDAY_LABELS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

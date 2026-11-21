import type { Business } from '@prisma/client';
import type { BusinessDetail } from '@turnify/shared';

export function toBusinessDetail(business: Business): BusinessDetail {
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    category: business.category,
    description: business.description,
    address: business.address,
    phone: business.phone,
    timezone: business.timezone,
    cancellationMinHours: business.cancellationMinHours,
    slotIntervalMinutes: business.slotIntervalMinutes,
    bookingHorizonDays: business.bookingHorizonDays,
    autoConfirm: business.autoConfirm,
  };
}

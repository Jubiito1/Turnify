import { DateTime } from 'luxon';
import type { AvailabilitySlot } from '@turnify/shared';

/**
 * Pure availability engine (RN-001, RN-004, RN-005, RN-007, RN-008, RN-012, RN-019, RN-027, RN-034).
 *
 * Working hours are wall-clock minutes in the business time zone, so "09:00" stays 09:00 local
 * across daylight-saving changes. Busy intervals are absolute instants (active bookings and blocks).
 * All interval comparisons are half-open: [start, end).
 */

export interface WorkingRange {
  weekday: number; // 0 = Sunday … 6 = Saturday
  startMinute: number;
  endMinute: number;
}

export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface ProfessionalSchedule {
  id: string;
  workingHours: WorkingRange[];
  /** Active bookings (PENDING/CONFIRMED) and time blocks. Cancelled bookings must not be included. */
  busy: BusyInterval[];
}

export interface AvailabilityInput {
  /** Local calendar date in the business time zone, YYYY-MM-DD. */
  date: string;
  timezone: string;
  durationMinutes: number;
  slotIntervalMinutes: number;
  bookingHorizonDays: number;
  now: Date;
  professionals: ProfessionalSchedule[];
}

/** Local wall-clock minute of a day as an absolute DateTime (minute 1440 = next midnight). */
function atLocalMinute(day: DateTime, minute: number): DateTime {
  if (minute >= 1440) return day.plus({ days: 1 }).startOf('day');
  return day.set({ hour: Math.floor(minute / 60), minute: minute % 60, second: 0, millisecond: 0 });
}

function overlaps(start: number, end: number, busy: BusyInterval[]): boolean {
  return busy.some((b) => start < b.end.getTime() && b.start.getTime() < end);
}

/** Candidate start times for one professional on one local day. */
export function professionalSlots(
  professional: ProfessionalSchedule,
  input: Omit<AvailabilityInput, 'professionals'>,
): { start: DateTime; end: DateTime }[] {
  const day = DateTime.fromISO(input.date, { zone: input.timezone }).startOf('day');
  if (!day.isValid) return [];

  const weekday = day.weekday % 7; // Luxon: 1 = Monday … 7 = Sunday
  const nowMs = input.now.getTime();
  const horizonMs = nowMs + input.bookingHorizonDays * 24 * 60 * 60 * 1000;
  const slots: { start: DateTime; end: DateTime }[] = [];

  const ranges = professional.workingHours
    .filter((range) => range.weekday === weekday)
    .sort((a, b) => a.startMinute - b.startMinute);

  for (const range of ranges) {
    const rangeEnd = atLocalMinute(day, range.endMinute).toMillis();
    // RN-034: starts are aligned to the slot interval from the start of each working range.
    for (
      let minute = range.startMinute;
      minute + input.durationMinutes <= range.endMinute;
      minute += input.slotIntervalMinutes
    ) {
      const start = atLocalMinute(day, minute);
      // RN-007: the duration is absolute time, independent of DST.
      const end = start.plus({ minutes: input.durationMinutes });
      const startMs = start.toMillis();
      const endMs = end.toMillis();

      if (endMs > rangeEnd) continue; // RN-004: must fit entirely within the range
      if (startMs <= nowMs) continue; // RN-001: never in the past
      if (startMs > horizonMs) continue; // RN-027: within the booking horizon
      if (overlaps(startMs, endMs, professional.busy)) continue; // RN-005, RN-006

      slots.push({ start, end });
    }
  }
  return slots;
}

/** Available slots for a service on a date, merged across professionals and sorted by start. */
export function computeAvailableSlots(input: AvailabilityInput): AvailabilitySlot[] {
  const byStart = new Map<string, AvailabilitySlot>();

  for (const professional of input.professionals) {
    for (const { start, end } of professionalSlots(professional, input)) {
      const startsAt = start.toUTC().toISO()!;
      const existing = byStart.get(startsAt);
      if (existing) existing.professionalIds.push(professional.id);
      else {
        byStart.set(startsAt, {
          startsAt,
          endsAt: end.toUTC().toISO()!,
          professionalIds: [professional.id],
        });
      }
    }
  }

  return [...byStart.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Local calendar date (YYYY-MM-DD) of an instant in the given time zone. */
export function localDateOf(instant: Date, timezone: string): string {
  return DateTime.fromJSDate(instant, { zone: timezone }).toISODate()!;
}

/** UTC window that safely covers a local day (used to query bookings/blocks for that day). */
export function dayWindow(date: string, timezone: string): { from: Date; to: Date } {
  const day = DateTime.fromISO(date, { zone: timezone }).startOf('day');
  return { from: day.minus({ hours: 12 }).toJSDate(), to: day.plus({ hours: 36 }).toJSDate() };
}

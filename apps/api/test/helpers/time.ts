import { DateTime } from 'luxon';

export const TZ = 'America/Argentina/Buenos_Aires';

/**
 * Next local date (YYYY-MM-DD) in Buenos Aires falling on `weekday` (0 = Sunday … 6 = Saturday)
 * at least `minDaysAhead` days from today, so tests never depend on the current time of day.
 */
export function nextWeekday(weekday: number, minDaysAhead = 2): string {
  let day = DateTime.now().setZone(TZ).startOf('day').plus({ days: minDaysAhead });
  while (day.weekday % 7 !== weekday) day = day.plus({ days: 1 });
  return day.toISODate()!;
}

/** Instant (ISO, UTC) for a local date and HH:MM in Buenos Aires. */
export function localTime(date: string, hhmm: string): string {
  const [hour, minute] = hhmm.split(':').map(Number);
  return DateTime.fromISO(date, { zone: TZ }).set({ hour, minute }).toUTC().toISO()!;
}

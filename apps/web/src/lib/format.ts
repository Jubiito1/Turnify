import { DateTime } from 'luxon';

export { formatPrice } from '@turnify/shared';

const LOCALE = 'es';

/** All dates are displayed in the business time zone (RN-019). */
export function toZoned(iso: string, timezone: string): DateTime {
  return DateTime.fromISO(iso, { zone: timezone }).setLocale(LOCALE);
}

export function formatTime(iso: string, timezone: string): string {
  return toZoned(iso, timezone).toFormat('HH:mm');
}

/** "miércoles 26 de noviembre" */
export function formatLongDate(iso: string, timezone: string): string {
  return toZoned(iso, timezone).toFormat("cccc d 'de' LLLL");
}

/** "mié 26 nov · 10:30" */
export function formatShortDateTime(iso: string, timezone: string): string {
  return toZoned(iso, timezone).toFormat("ccc d LLL '·' HH:mm");
}

/** Local calendar date "2026-11-26" for a date-only string, formatted as "mié 26/11". */
export function formatDayLabel(date: string, timezone: string): string {
  return DateTime.fromISO(date, { zone: timezone }).setLocale(LOCALE).toFormat('ccc d/LL');
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function todayIn(timezone: string): string {
  return DateTime.now().setZone(timezone).toISODate()!;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

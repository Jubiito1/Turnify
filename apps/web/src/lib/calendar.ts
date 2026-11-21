import { DateTime } from 'luxon';

/** ISO instant for a local date + "HH:MM" in the business time zone (RN-019). */
export function localToIso(date: string, hhmm: string, timezone: string): string {
  const [hour, minute] = hhmm.split(':').map(Number);
  return DateTime.fromISO(date, { zone: timezone })
    .set({ hour, minute, second: 0, millisecond: 0 })
    .toUTC()
    .toISO()!;
}

/** Monday-based week containing `date` (local dates, inclusive). */
export function weekRange(
  date: string,
  timezone: string,
): { from: string; to: string; days: string[] } {
  const start = DateTime.fromISO(date, { zone: timezone }).startOf('week'); // Luxon weeks start on Monday
  const days = Array.from({ length: 7 }, (_, i) => start.plus({ days: i }).toISODate()!);
  return { from: days[0]!, to: days[6]!, days };
}

/** Calendar grid (whole weeks, Monday first) covering the month of `date`. */
export function monthGrid(
  date: string,
  timezone: string,
): { from: string; to: string; days: string[]; month: number } {
  const d = DateTime.fromISO(date, { zone: timezone });
  const start = d.startOf('month').startOf('week');
  const end = d.endOf('month').endOf('week');
  const count = Math.round(end.diff(start, 'days').days);
  const days = Array.from({ length: count }, (_, i) => start.plus({ days: i }).toISODate()!);
  return { from: days[0]!, to: days[days.length - 1]!, days, month: d.month };
}

export function shiftDate(
  date: string,
  timezone: string,
  amount: { weeks?: number; months?: number },
): string {
  return DateTime.fromISO(date, { zone: timezone }).plus(amount).toISODate()!;
}

/** Minutes since local midnight of an instant. */
export function minuteOfDay(iso: string, timezone: string): number {
  const d = DateTime.fromISO(iso, { zone: timezone });
  return d.hour * 60 + d.minute;
}

export function localDate(iso: string, timezone: string): string {
  return DateTime.fromISO(iso, { zone: timezone }).toISODate()!;
}

/**
 * Side-by-side layout for overlapping events in a day column: each cluster of transitively
 * overlapping events shares the width, and every event gets the first free lane.
 */
export function layoutLanes<T extends { id: string; startsAt: string; endsAt: string }>(
  events: T[],
): Map<string, { lane: number; lanes: number }> {
  const sorted = [...events].sort(
    (a, b) => a.startsAt.localeCompare(b.startsAt) || b.endsAt.localeCompare(a.endsAt),
  );
  const result = new Map<string, { lane: number; lanes: number }>();
  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: string[] = [];
  let clusterEnd = '';

  const flush = () => {
    cluster.forEach((e) => result.set(e.id, { lane: e.lane, lanes: laneEnds.length }));
    cluster = [];
    laneEnds = [];
  };

  for (const event of sorted) {
    // An event starting after everything in the current cluster ends begins a new cluster.
    if (cluster.length && event.startsAt >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= event.startsAt);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(event.endsAt);
    } else {
      laneEnds[lane] = event.endsAt;
    }
    cluster.push({ id: event.id, lane });
    clusterEnd = cluster.length === 1 || event.endsAt > clusterEnd ? event.endsAt : clusterEnd;
  }
  flush();
  return result;
}

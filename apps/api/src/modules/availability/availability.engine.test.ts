import { describe, expect, it } from 'vitest';
import {
  computeAvailableSlots,
  dayWindow,
  localDateOf,
  type AvailabilityInput,
  type ProfessionalSchedule,
} from './availability.engine';

const BA = 'America/Argentina/Buenos_Aires'; // UTC-3, no DST
const MONDAY = '2030-01-07';

const pro = (overrides: Partial<ProfessionalSchedule> = {}): ProfessionalSchedule => ({
  id: 'pro-1',
  workingHours: [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }],
  busy: [],
  ...overrides,
});

const input = (overrides: Partial<AvailabilityInput> = {}): AvailabilityInput => ({
  date: MONDAY,
  timezone: BA,
  durationMinutes: 60,
  slotIntervalMinutes: 30,
  bookingHorizonDays: 365 * 10,
  now: new Date('2029-12-01T00:00:00Z'),
  professionals: [pro()],
  ...overrides,
});

const starts = (slots: { startsAt: string }[]) => slots.map((s) => s.startsAt);

describe('availability engine', () => {
  it('generates aligned slots that fit entirely inside working hours (RN-004, RN-034)', () => {
    // 09:00–12:00 local (12:00Z–15:00Z), 60 min service, 30 min step: last start 11:00 local
    expect(starts(computeAvailableSlots(input()))).toEqual([
      '2030-01-07T12:00:00.000Z',
      '2030-01-07T12:30:00.000Z',
      '2030-01-07T13:00:00.000Z',
      '2030-01-07T13:30:00.000Z',
      '2030-01-07T14:00:00.000Z',
    ]);
  });

  it('derives the end time from the service duration (RN-007)', () => {
    const [first] = computeAvailableSlots(input({ durationMinutes: 45 }));
    expect(first).toMatchObject({
      startsAt: '2030-01-07T12:00:00.000Z',
      endsAt: '2030-01-07T12:45:00.000Z',
    });
  });

  it('returns nothing on non-working days or for invalid dates', () => {
    expect(computeAvailableSlots(input({ date: '2030-01-08' }))).toEqual([]); // Tuesday
    expect(computeAvailableSlots(input({ date: '2030-02-30' }))).toEqual([]);
  });

  it('supports split shifts', () => {
    const slots = computeAvailableSlots(
      input({
        durationMinutes: 60,
        slotIntervalMinutes: 60,
        professionals: [
          pro({
            workingHours: [
              { weekday: 1, startMinute: 9 * 60, endMinute: 11 * 60 },
              { weekday: 1, startMinute: 14 * 60, endMinute: 16 * 60 },
            ],
          }),
        ],
      }),
    );
    expect(starts(slots)).toEqual([
      '2030-01-07T12:00:00.000Z',
      '2030-01-07T13:00:00.000Z',
      '2030-01-07T17:00:00.000Z',
      '2030-01-07T18:00:00.000Z',
    ]);
  });

  it('excludes slots overlapping busy intervals but keeps back-to-back slots (RN-005, RN-006)', () => {
    const busy = [
      // Existing booking 10:00–11:00 local
      { start: new Date('2030-01-07T13:00:00Z'), end: new Date('2030-01-07T14:00:00Z') },
    ];
    const slots = computeAvailableSlots(input({ professionals: [pro({ busy })] }));
    // 09:00 (ends 10:00, touches but does not overlap) and 11:00 (starts when busy ends) remain
    expect(starts(slots)).toEqual(['2030-01-07T12:00:00.000Z', '2030-01-07T14:00:00.000Z']);
  });

  it('never offers past slots (RN-001)', () => {
    const slots = computeAvailableSlots(input({ now: new Date('2030-01-07T13:10:00Z') }));
    expect(starts(slots)).toEqual(['2030-01-07T13:30:00.000Z', '2030-01-07T14:00:00.000Z']);
  });

  it('respects the booking horizon (RN-027)', () => {
    const now = new Date('2030-01-01T12:00:00Z');
    expect(computeAvailableSlots(input({ now, bookingHorizonDays: 3 }))).toEqual([]);
    expect(computeAvailableSlots(input({ now, bookingHorizonDays: 7 })).length).toBe(5);
  });

  it('merges slots across professionals listing who is free (RN-008)', () => {
    const slots = computeAvailableSlots(
      input({
        slotIntervalMinutes: 60,
        professionals: [
          pro({ id: 'a' }),
          pro({
            id: 'b',
            busy: [
              { start: new Date('2030-01-07T12:00:00Z'), end: new Date('2030-01-07T13:00:00Z') },
            ],
          }),
        ],
      }),
    );
    expect(slots).toEqual([
      expect.objectContaining({ startsAt: '2030-01-07T12:00:00.000Z', professionalIds: ['a'] }),
      expect.objectContaining({
        startsAt: '2030-01-07T13:00:00.000Z',
        professionalIds: ['a', 'b'],
      }),
      expect.objectContaining({
        startsAt: '2030-01-07T14:00:00.000Z',
        professionalIds: ['a', 'b'],
      }),
    ]);
  });

  it('interprets working hours in the business time zone (RN-019)', () => {
    const madrid = computeAvailableSlots(input({ timezone: 'Europe/Madrid' })); // UTC+1 in January
    expect(madrid[0]?.startsAt).toBe('2030-01-07T08:00:00.000Z');
  });

  it('keeps 09:00 local across a daylight-saving change (RN-019)', () => {
    const ny = 'America/New_York';
    const hours = [
      { weekday: 6, startMinute: 9 * 60, endMinute: 10 * 60 },
      { weekday: 0, startMinute: 9 * 60, endMinute: 10 * 60 },
    ];
    const base = {
      timezone: ny,
      now: new Date('2026-01-01T00:00:00Z'),
      professionals: [pro({ workingHours: hours })],
    };
    // Saturday 2026-03-07 is EST (UTC-5); Sunday 2026-03-08 is EDT (UTC-4)
    expect(computeAvailableSlots(input({ ...base, date: '2026-03-07' }))[0]?.startsAt).toBe(
      '2026-03-07T14:00:00.000Z',
    );
    expect(computeAvailableSlots(input({ ...base, date: '2026-03-08' }))[0]?.startsAt).toBe(
      '2026-03-08T13:00:00.000Z',
    );
  });

  it('handles ranges ending at midnight', () => {
    const slots = computeAvailableSlots(
      input({
        slotIntervalMinutes: 60,
        professionals: [
          pro({ workingHours: [{ weekday: 1, startMinute: 22 * 60, endMinute: 1440 }] }),
        ],
      }),
    );
    expect(starts(slots)).toEqual(['2030-01-08T01:00:00.000Z', '2030-01-08T02:00:00.000Z']);
  });
});

describe('time helpers', () => {
  it('computes the local date of an instant', () => {
    expect(localDateOf(new Date('2030-01-08T02:30:00Z'), BA)).toBe('2030-01-07');
  });

  it('builds a query window that covers the whole local day', () => {
    const { from, to } = dayWindow(MONDAY, BA);
    expect(from.getTime()).toBeLessThan(new Date('2030-01-07T03:00:00Z').getTime());
    expect(to.getTime()).toBeGreaterThan(new Date('2030-01-08T03:00:00Z').getTime());
  });
});

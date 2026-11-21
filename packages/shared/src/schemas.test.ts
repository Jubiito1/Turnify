import { describe, expect, it } from 'vitest';
import {
  bookingListQuerySchema,
  businessSettingsSchema,
  passwordSchema,
  registerSchema,
  serviceCreateSchema,
  timeBlockCreateSchema,
  workingHoursSchema,
} from './index';
import { hhmmToMinutes, intervalsOverlap, isValidTimeZone, minutesToHHMM } from './time';

describe('credentials (RN-031)', () => {
  it('normalizes email to lowercase', () => {
    const parsed = registerSchema.parse({
      name: 'Ana',
      email: '  Ana@Mail.COM ',
      password: 'secret123',
    });
    expect(parsed.email).toBe('ana@mail.com');
  });

  it.each(['short1', 'onlyletters', '12345678', 'a'.repeat(72) + '1'])(
    'rejects weak password %j',
    (pw) => {
      expect(passwordSchema.safeParse(pw).success).toBe(false);
    },
  );

  it('accepts a valid password', () => {
    expect(passwordSchema.safeParse('turnify2026').success).toBe(true);
  });
});

describe('working hours (RN-030)', () => {
  it('accepts non-overlapping ranges, including split shifts', () => {
    const result = workingHoursSchema.safeParse({
      hours: [
        { weekday: 1, startMinute: 540, endMinute: 780 },
        { weekday: 1, startMinute: 840, endMinute: 1080 },
        { weekday: 2, startMinute: 540, endMinute: 1080 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts contiguous ranges', () => {
    const result = workingHoursSchema.safeParse({
      hours: [
        { weekday: 1, startMinute: 540, endMinute: 780 },
        { weekday: 1, startMinute: 780, endMinute: 900 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects overlapping ranges on the same day', () => {
    const result = workingHoursSchema.safeParse({
      hours: [
        { weekday: 3, startMinute: 540, endMinute: 780 },
        { weekday: 3, startMinute: 700, endMinute: 900 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects start >= end and out-of-range values', () => {
    expect(
      workingHoursSchema.safeParse({ hours: [{ weekday: 1, startMinute: 600, endMinute: 600 }] })
        .success,
    ).toBe(false);
    expect(
      workingHoursSchema.safeParse({ hours: [{ weekday: 7, startMinute: 0, endMinute: 60 }] })
        .success,
    ).toBe(false);
    expect(
      workingHoursSchema.safeParse({ hours: [{ weekday: 1, startMinute: 0, endMinute: 1441 }] })
        .success,
    ).toBe(false);
  });
});

describe('services (RN-007, RN-018)', () => {
  it('requires integer, non-negative cents', () => {
    const base = { name: 'Corte', durationMinutes: 30 };
    expect(serviceCreateSchema.safeParse({ ...base, priceCents: 1500.5 }).success).toBe(false);
    expect(serviceCreateSchema.safeParse({ ...base, priceCents: -1 }).success).toBe(false);
    expect(serviceCreateSchema.parse({ ...base, priceCents: 150000 }).isActive).toBe(true);
  });

  it('requires duration in 5-minute steps', () => {
    expect(
      serviceCreateSchema.safeParse({ name: 'Corte', durationMinutes: 32, priceCents: 0 }).success,
    ).toBe(false);
  });
});

describe('business settings', () => {
  const valid = {
    name: 'Studio',
    category: 'BEAUTY',
    timezone: 'America/Argentina/Buenos_Aires',
    cancellationMinHours: 24,
    slotIntervalMinutes: 15,
    bookingHorizonDays: 60,
    autoConfirm: false,
  };

  it('accepts valid settings', () => {
    expect(businessSettingsSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an unknown time zone (RN-019)', () => {
    expect(businessSettingsSchema.safeParse({ ...valid, timezone: 'Mars/Olympus' }).success).toBe(
      false,
    );
  });

  it('rejects slot intervals outside the allowed list (RN-034)', () => {
    expect(businessSettingsSchema.safeParse({ ...valid, slotIntervalMinutes: 7 }).success).toBe(
      false,
    );
  });
});

describe('time blocks', () => {
  const professionalId = '6f1c1b1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f';

  it('rejects blocks that end before they start', () => {
    const result = timeBlockCreateSchema.safeParse({
      professionalId,
      startsAt: '2026-12-10T15:00:00Z',
      endsAt: '2026-12-10T14:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('accepts ISO datetimes with offsets', () => {
    const result = timeBlockCreateSchema.safeParse({
      professionalId,
      startsAt: '2026-12-10T09:00:00-03:00',
      endsAt: '2026-12-10T13:00:00-03:00',
    });
    expect(result.success).toBe(true);
  });
});

describe('booking list query', () => {
  it('parses a comma separated status list', () => {
    expect(bookingListQuerySchema.parse({ status: 'PENDING,CONFIRMED' }).status).toEqual([
      'PENDING',
      'CONFIRMED',
    ]);
  });

  it('rejects unknown statuses', () => {
    expect(bookingListQuerySchema.safeParse({ status: 'PENDING,LOST' }).success).toBe(false);
  });

  it('applies pagination defaults', () => {
    expect(bookingListQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 20 });
  });
});

describe('time helpers', () => {
  it('converts minutes and HH:MM', () => {
    expect(minutesToHHMM(570)).toBe('09:30');
    expect(hhmmToMinutes('09:30')).toBe(570);
    expect(hhmmToMinutes('24:00')).toBe(1440);
    expect(hhmmToMinutes('24:30')).toBeNull();
    expect(hhmmToMinutes('9:30')).toBeNull();
  });

  it('detects half-open overlaps', () => {
    expect(intervalsOverlap(0, 10, 10, 20)).toBe(false);
    expect(intervalsOverlap(0, 11, 10, 20)).toBe(true);
  });

  it('validates IANA time zones', () => {
    expect(isValidTimeZone('America/Argentina/Buenos_Aires')).toBe(true);
    expect(isValidTimeZone('Nowhere/City')).toBe(false);
  });
});

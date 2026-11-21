import { describe, expect, it } from 'vitest';
import { AppError } from '../../lib/errors';
import {
  assertClientNotice,
  assertReschedulable,
  assertStartedIfRequired,
  assertTransition,
} from './booking.policy';

function codeOf(fn: () => void): string | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    return error instanceof AppError ? error.code : 'UNKNOWN';
  }
}

const now = new Date('2030-01-07T12:00:00Z');
const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3_600_000);

describe('booking policy', () => {
  it('allows valid transitions and rejects invalid ones (RN-015)', () => {
    expect(codeOf(() => assertTransition('PENDING', 'CONFIRMED'))).toBeUndefined();
    expect(codeOf(() => assertTransition('CONFIRMED', 'COMPLETED'))).toBeUndefined();
    expect(codeOf(() => assertTransition('COMPLETED', 'CANCELLED'))).toBe('INVALID_TRANSITION');
    expect(codeOf(() => assertTransition('PENDING', 'NO_SHOW'))).toBe('INVALID_TRANSITION');
  });

  it('never completes a cancelled booking (RN-014)', () => {
    expect(codeOf(() => assertTransition('CANCELLED', 'COMPLETED'))).toBe('INVALID_TRANSITION');
  });

  it('requires the appointment to have started to complete it (RN-026)', () => {
    expect(codeOf(() => assertStartedIfRequired('COMPLETED', hoursFromNow(1), now))).toBe(
      'BOOKING_NOT_STARTED',
    );
    expect(codeOf(() => assertStartedIfRequired('NO_SHOW', hoursFromNow(1), now))).toBe(
      'BOOKING_NOT_STARTED',
    );
    expect(
      codeOf(() => assertStartedIfRequired('COMPLETED', hoursFromNow(-1), now)),
    ).toBeUndefined();
    expect(
      codeOf(() => assertStartedIfRequired('CANCELLED', hoursFromNow(1), now)),
    ).toBeUndefined();
  });

  it('enforces the minimum notice for clients (RN-013)', () => {
    expect(codeOf(() => assertClientNotice(hoursFromNow(23), 24, now))).toBe(
      'CANCELLATION_WINDOW_PASSED',
    );
    expect(codeOf(() => assertClientNotice(hoursFromNow(24), 24, now))).toBeUndefined();
    expect(codeOf(() => assertClientNotice(hoursFromNow(1), 0, now))).toBeUndefined();
  });

  it('only reschedules active bookings', () => {
    expect(codeOf(() => assertReschedulable('CONFIRMED'))).toBeUndefined();
    expect(codeOf(() => assertReschedulable('PENDING'))).toBeUndefined();
    expect(codeOf(() => assertReschedulable('CANCELLED'))).toBe('BOOKING_NOT_ACTIVE');
    expect(codeOf(() => assertReschedulable('COMPLETED'))).toBe('BOOKING_NOT_ACTIVE');
  });
});

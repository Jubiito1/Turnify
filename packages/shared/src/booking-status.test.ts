import { describe, expect, it } from 'vitest';
import { BOOKING_TRANSITIONS, canTransition, isFinalStatus } from './booking-status';
import { BOOKING_STATUSES, isActiveStatus } from './enums';

describe('booking status transitions (RN-015)', () => {
  it.each([
    ['PENDING', 'CONFIRMED'],
    ['PENDING', 'CANCELLED'],
    ['CONFIRMED', 'COMPLETED'],
    ['CONFIRMED', 'CANCELLED'],
    ['CONFIRMED', 'NO_SHOW'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['PENDING', 'COMPLETED'],
    ['PENDING', 'NO_SHOW'],
    ['CONFIRMED', 'PENDING'],
    ['COMPLETED', 'CANCELLED'],
    ['NO_SHOW', 'CONFIRMED'],
    ['CANCELLED', 'CONFIRMED'],
  ] as const)('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('never allows completing a cancelled booking (RN-014)', () => {
    expect(canTransition('CANCELLED', 'COMPLETED')).toBe(false);
  });

  it('never allows a self transition', () => {
    for (const status of BOOKING_STATUSES) expect(canTransition(status, status)).toBe(false);
  });

  it('marks COMPLETED, CANCELLED and NO_SHOW as final', () => {
    expect(BOOKING_STATUSES.filter(isFinalStatus)).toEqual(['COMPLETED', 'CANCELLED', 'NO_SHOW']);
    expect(Object.keys(BOOKING_TRANSITIONS)).toHaveLength(BOOKING_STATUSES.length);
  });

  it('treats only PENDING and CONFIRMED as active (RN-012)', () => {
    expect(BOOKING_STATUSES.filter(isActiveStatus)).toEqual(['PENDING', 'CONFIRMED']);
  });
});

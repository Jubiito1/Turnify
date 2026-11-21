import { describe, expect, it } from 'vitest';
import { centsToAmountString, formatPrice, parseAmountToCents, sumCents } from './money';

describe('money helpers (RN-018)', () => {
  it.each([
    ['1500', 150000],
    ['1500.5', 150050],
    ['1500,50', 150050],
    ['0.10', 10],
    ['0.29', 29],
    [' 12 ', 1200],
  ])('parses %j into %d cents without float drift', (input, expected) => {
    expect(parseAmountToCents(input)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '1.234', '1e3', '12.'])('rejects invalid amount %j', (input) => {
    expect(parseAmountToCents(input)).toBeNull();
  });

  it('round-trips cents to a decimal string', () => {
    expect(centsToAmountString(150050)).toBe('1500.50');
    expect(centsToAmountString(7)).toBe('0.07');
    expect(parseAmountToCents(centsToAmountString(123456))).toBe(123456);
  });

  it('sums integer cents exactly where floats would drift', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumCents([10, 20])).toBe(30);
    expect(() => sumCents([10, 0.5])).toThrow(TypeError);
  });

  it('formats prices as ARS currency', () => {
    expect(formatPrice(150000)).toMatch(/1\.500/);
    expect(formatPrice(150050)).toMatch(/1\.500,50/);
  });
});

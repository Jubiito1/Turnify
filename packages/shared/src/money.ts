/**
 * Money helpers. Amounts are always integer cents. RN-018
 * Parsing works on the decimal string to avoid floating point rounding.
 */

const AMOUNT_PATTERN = /^\d{1,9}([.,]\d{1,2})?$/;

/** Parses a user-entered amount ("1500", "1500.5", "1500,50") into integer cents. Returns null if invalid. */
export function parseAmountToCents(input: string): number | null {
  const value = input.trim();
  if (!AMOUNT_PATTERN.test(value)) return null;
  const [whole = '0', fraction = ''] = value.split(/[.,]/);
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Converts integer cents to a plain decimal string ("1500.50") for form inputs. */
export function centsToAmountString(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.trunc(abs / 100);
  const fraction = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${fraction}`;
}

/** Formats integer cents as a localized currency string. */
export function formatPrice(cents: number, currency = 'ARS', locale = 'es-AR'): string {
  const hasFraction = cents % 100 !== 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Sums integer cent amounts, guarding against non-integer input. */
export function sumCents(values: readonly number[]): number {
  return values.reduce((total, value) => {
    if (!Number.isInteger(value)) throw new TypeError(`Amount must be integer cents: ${value}`);
    return total + value;
  }, 0);
}

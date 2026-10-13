import type { ValidationOptions } from 'class-validator';
import { ValidateBy } from 'class-validator';

/**
 * A money amount as a decimal string: up to 10 integer digits (no leading zeros) and
 * at most 2 decimals, e.g. "0.01", "125.5", "9999999999.99". The regex alone rules out
 * numbers, signs, spaces, exponents and a third decimal; the format matches the
 * PostgreSQL DECIMAL(12,2) column exactly, so the database never has to round.
 */
const MONEY_PATTERN = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;

/** True for a strictly positive money string. No floating-point arithmetic is involved. */
export function isMoneyString(value: unknown): value is string {
  if (typeof value !== 'string' || !MONEY_PATTERN.test(value)) return false;
  // Positive means at least one non-zero digit; "0", "0.0" and "0.00" are rejected.
  return /[1-9]/.test(value);
}

export function IsMoneyString(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isMoneyString',
      validator: {
        validate: (value: unknown) => isMoneyString(value),
        defaultMessage: (args) =>
          `${args?.property ?? 'value'} must be a positive decimal string with at most 2 decimals and at most 9999999999.99, e.g. "125.50"`,
      },
    },
    options,
  );
}

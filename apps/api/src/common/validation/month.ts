import type { ValidationOptions } from 'class-validator';
import { ValidateBy } from 'class-validator';

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** True for 'YYYY-MM' with a month from 01 to 12 (year 0001-9999). */
export function isMonth(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = MONTH_PATTERN.exec(value);
  return match !== null && Number(match[1]) >= 1;
}

/**
 * The half-open range [first day of the month, first day of the next month), as UTC
 * midnights. Used as `date >= gte AND date < lt`, it includes the last day of every
 * month without knowing how many days the month has. December rolls over into January.
 */
export function monthRange(month: string): { gte: Date; lt: Date } {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  return {
    gte: new Date(Date.UTC(year, monthNumber - 1, 1)),
    lt: new Date(Date.UTC(year, monthNumber, 1)),
  };
}

export function IsMonth(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isMonth',
      validator: {
        validate: (value: unknown) => isMonth(value),
        defaultMessage: (args) =>
          `${args?.property ?? 'value'} must be a month in YYYY-MM format, e.g. "2026-10"`,
      },
    },
    options,
  );
}

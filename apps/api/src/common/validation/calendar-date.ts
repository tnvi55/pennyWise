import type { ValidationOptions } from 'class-validator';
import { ValidateBy } from 'class-validator';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * True for a real calendar day written as YYYY-MM-DD (year 0001-9999).
 * "2026-02-29" and "2026-04-31" are rejected; "2028-02-29" (leap year) is accepted.
 * Datetimes such as "2026-10-03T10:00:00Z" never match the pattern.
 */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  // Day 0 of the next month is the last day of this month, computed in UTC.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

/**
 * 'YYYY-MM-DD' → a Date at UTC midnight. Prisma writes that instant to a PostgreSQL
 * DATE column as exactly that calendar day, whatever the server's local timezone.
 */
export function toUtcDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** The reverse of toUtcDate: a DATE value read by Prisma (UTC midnight) → 'YYYY-MM-DD'. */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function IsCalendarDate(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isCalendarDate',
      validator: {
        validate: (value: unknown) => isCalendarDate(value),
        defaultMessage: (args) =>
          `${args?.property ?? 'value'} must be a real calendar date in YYYY-MM-DD format, e.g. "2026-10-03"`,
      },
    },
    options,
  );
}

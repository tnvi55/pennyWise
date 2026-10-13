# ADR 0004: Money and dates at the API boundary

- Status: Accepted
- Date: 2026-10-13

## Context

Transactions carry money amounts (INR) and calendar dates. Two classic bugs hide here:

- **Floating-point money.** In JavaScript, `0.1 + 0.2` is `0.30000000000000004`, and a JSON number such as `125.5` is already a binary float when it reaches the server.
- **Timezone drift.** A JS `Date` is an instant, not a calendar day. Converting `'2026-10-31'` through a local timezone can store or show `2026-10-30`.

plan.md section 14 requires decimal-string inputs, `DECIMAL(12,2)` storage, fixed two-decimal output, `YYYY-MM-DD` dates in a `DATE` column, and no drift.

## Decision

- **Money in:** the API accepts only a JSON **string** matching `^(0|[1-9]\d{0,9})(\.\d{1,2})?$`, with at least one non-zero digit.
  - This format matches `DECIMAL(12,2)` exactly, so PostgreSQL never rounds. (It would silently round `1.005` to `1.01`; see `docs/sql-basics.md`.)
  - JSON numbers, signs, exponents, spaces and leading zeros are rejected with 400.
- **Money stored and out:** the string is passed to Prisma unchanged. Prisma returns a `Decimal` (decimal.js), and the response uses `Decimal.toFixed(2)`. No JS `number` is ever involved.
  - Totals (Phase 5) will be computed by PostgreSQL's `sum()` on `DECIMAL`, not in JavaScript.
- **Dates in:** a string `YYYY-MM-DD` that is a real calendar day (leap years included, checked with UTC arithmetic). Datetimes are rejected.
- **Dates stored and out:** `toUtcDate('2026-10-31')` = `2026-10-31T00:00:00.000Z`. Prisma writes that instant to the `DATE` column as `2026-10-31`, reads it back as the same UTC midnight, and `toDateString()` (`toISOString().slice(0, 10)`) returns `'2026-10-31'`. Local server time is never used.
- **Months:** `monthRange('YYYY-MM')` gives `[first day, first day of next month)` in UTC. It's used as `date >= gte AND date < lt`, so no "last day of month" calculation is needed and December rolls over correctly.

## Alternatives considered

| Option                                     | Why not                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Accept JSON numbers for `amount`           | The value is already a float when parsed; `0.1 + 0.2` style errors and silent rounding become possible. |
| Store amounts as integer paise (`BIGINT`)  | Also exact, but the plan fixes `DECIMAL(12,2)`, and the GUI/SQL lessons read more naturally in rupees.  |
| `Date` objects or ISO datetimes in the API | Instants depend on timezones; a calendar day is the real-world concept for an expense.                  |
| A date library (date-fns, Luxon)           | The three needed operations are short and fully tested with UTC arithmetic; no dependency needed.       |
| Store `date` as `TIMESTAMPTZ`              | Reintroduces the timezone problem the `DATE` type avoids.                                               |

## Consequences

- API clients (the React app in Phase 6) must send amounts as strings. A form input is a string anyway, so it's sent without converting through `Number`.
- The validators live in `apps/api/src/common/validation/`, with boundary-case unit tests. Every money, date or month input must go through them.

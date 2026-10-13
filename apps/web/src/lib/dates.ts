// Calendar-date helpers using UTC arithmetic only, so the browser's timezone never shifts a day.

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Same rule as the API: a real calendar day as YYYY-MM-DD. */
export function isCalendarDate(value: string): boolean {
  const match = DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The current month as YYYY-MM in the user's local calendar (what "this month" means to them). */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Today as YYYY-MM-DD in the user's local calendar, the default date for a new transaction. */
export function today(now: Date = new Date()): string {
  return `${currentMonth(now)}-${String(now.getDate()).padStart(2, '0')}`;
}

/** "2026-10" → "October 2026", without creating a Date in the local timezone. */
export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

/** "2026-10-03" → "3 Oct 2026", formatted in UTC so the day never moves. */
export function dateLabel(day: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00.000Z`));
}

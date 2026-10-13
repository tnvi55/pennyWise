import { isCalendarDate, toDateString, toUtcDate } from './calendar-date';
import { isMoneyString } from './money';
import { isMonth, monthRange } from './month';

describe('isMoneyString', () => {
  it.each(['0.01', '0.1', '1', '1.5', '125.50', '22000', '9999999999.99', '1000000000'])(
    'accepts %p',
    (value) => {
      expect(isMoneyString(value)).toBe(true);
    },
  );

  it.each([
    ['0', 'zero'],
    ['0.0', 'zero'],
    ['0.00', 'zero'],
    ['-5', 'negative'],
    ['+5', 'plus sign'],
    ['1e3', 'exponent'],
    ['1.005', 'three decimals'],
    ['1.', 'trailing dot'],
    ['.5', 'no integer part'],
    ['01.5', 'leading zero'],
    [' 5', 'leading space'],
    ['5 ', 'trailing space'],
    ['1,000', 'thousands separator'],
    ['10000000000', 'above the maximum'],
    ['10000000000.00', 'above the maximum'],
    ['', 'empty string'],
    ['abc', 'not a number'],
    ['NaN', 'NaN'],
    ['Infinity', 'Infinity'],
  ])('rejects %p (%s)', (value) => {
    expect(isMoneyString(value)).toBe(false);
  });

  it.each([[125.5], [0.1], [null], [undefined], [{}], [['1']]])(
    'rejects non-string %p',
    (value) => {
      expect(isMoneyString(value)).toBe(false);
    },
  );
});

describe('isCalendarDate', () => {
  it.each([
    '2026-10-03',
    '2026-01-01',
    '2026-12-31',
    '2026-02-28',
    '2028-02-29',
    '2000-02-29',
    '0001-01-01',
  ])('accepts %p', (value) => {
    expect(isCalendarDate(value)).toBe(true);
  });

  it.each([
    ['2026-02-29', 'not a leap year'],
    ['1900-02-29', 'century, not a leap year'],
    ['2026-04-31', '30-day month'],
    ['2026-13-01', 'month 13'],
    ['2026-00-10', 'month 0'],
    ['2026-10-00', 'day 0'],
    ['2026-10-32', 'day 32'],
    ['0000-01-01', 'year 0'],
    ['2026-1-3', 'missing zero padding'],
    ['26-10-03', 'two-digit year'],
    ['2026/10/03', 'slashes'],
    ['03-10-2026', 'day first'],
    ['2026-10-03T00:00:00Z', 'datetime'],
    ['2026-10-03 ', 'trailing space'],
    ['', 'empty string'],
  ])('rejects %p (%s)', (value) => {
    expect(isCalendarDate(value)).toBe(false);
  });

  it.each([[null], [undefined], [20261003], [new Date('2026-10-03')]])(
    'rejects non-string %p',
    (value) => {
      expect(isCalendarDate(value)).toBe(false);
    },
  );
});

describe('toUtcDate / toDateString', () => {
  it.each(['2026-10-31', '2026-01-01', '2028-02-29', '2026-12-31'])(
    'round-trips %p without timezone drift',
    (day) => {
      const date = toUtcDate(day);
      expect(date.toISOString()).toBe(`${day}T00:00:00.000Z`);
      expect(toDateString(date)).toBe(day);
    },
  );
});

describe('isMonth', () => {
  it.each(['2026-01', '2026-10', '2026-12', '0001-01'])('accepts %p', (value) => {
    expect(isMonth(value)).toBe(true);
  });

  it.each([
    '2026-00',
    '2026-13',
    '2026-1',
    '26-10',
    '2026-10-01',
    '2026/10',
    '0000-05',
    '',
    ' 2026-10',
  ])('rejects %p', (value) => {
    expect(isMonth(value)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isMonth(202610)).toBe(false);
    expect(isMonth(null)).toBe(false);
  });
});

describe('monthRange', () => {
  it('covers [first day, first day of next month)', () => {
    const range = monthRange('2026-10');
    expect(range.gte.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(range.lt.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('rolls December over into January of the next year', () => {
    const range = monthRange('2026-12');
    expect(range.gte.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(range.lt.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('handles February in a leap year', () => {
    expect(monthRange('2028-02').lt.toISOString()).toBe('2028-03-01T00:00:00.000Z');
  });
});

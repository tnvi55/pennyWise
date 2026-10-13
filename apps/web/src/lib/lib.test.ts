import { describe, expect, it } from 'vitest';

import { currentMonth, dateLabel, isCalendarDate, monthLabel, today } from './dates';
import { formatInr, isMoneyInput, isNegative } from './money';

describe('formatInr', () => {
  it.each([
    ['0.00', '₹0.00'],
    ['5', '₹5.00'],
    ['0.1', '₹0.10'],
    ['999.99', '₹999.99'],
    ['1000.00', '₹1,000.00'],
    ['22000.00', '₹22,000.00'],
    ['100000.00', '₹1,00,000.00'],
    ['1234567.5', '₹12,34,567.50'],
    ['9999999999.99', '₹9,99,99,99,999.99'],
    ['19999999999.98', '₹19,99,99,99,999.98'],
    ['-1500.50', '−₹1,500.50'],
    ['-0.00', '₹0.00'],
  ])('formats %p as %p', (input, expected) => {
    expect(formatInr(input)).toBe(expected);
  });

  it('returns unparseable input unchanged instead of guessing', () => {
    expect(formatInr('abc')).toBe('abc');
    expect(formatInr('1.005')).toBe('1.005');
  });

  it('keeps decimals exact (no float conversion)', () => {
    // As a JS number this would be 1.2345678901234568e+21.
    expect(formatInr('1234567890123456789012.34')).toBe('₹1,23,45,67,89,01,23,45,67,89,012.34');
  });
});

describe('isMoneyInput (mirrors the API rule)', () => {
  it.each(['0.01', '5', '125.5', '125.50', '9999999999.99'])('accepts %p', (value) => {
    expect(isMoneyInput(value)).toBe(true);
  });

  it.each(['', '0', '0.00', '-5', '+5', '1e3', '1.005', '01.5', ' 5', '1,000', '10000000000'])(
    'rejects %p',
    (value) => {
      expect(isMoneyInput(value)).toBe(false);
    },
  );
});

describe('isNegative', () => {
  it('is true only for negative non-zero amounts', () => {
    expect(isNegative('-1.00')).toBe(true);
    expect(isNegative('-0.00')).toBe(false);
    expect(isNegative('1.00')).toBe(false);
  });
});

describe('dates', () => {
  it.each(['2026-10-31', '2028-02-29'])('accepts %p', (value) => {
    expect(isCalendarDate(value)).toBe(true);
  });

  it.each(['2026-02-29', '2026-04-31', '2026-1-3', '2026-10-03T00:00:00Z', ''])(
    'rejects %p',
    (value) => {
      expect(isCalendarDate(value)).toBe(false);
    },
  );

  it('builds the current month and today from the local calendar', () => {
    const local = new Date(2026, 0, 5, 23, 30); // 5 Jan 2026, 23:30 local time
    expect(currentMonth(local)).toBe('2026-01');
    expect(today(local)).toBe('2026-01-05');
  });

  it('labels months and days without shifting them', () => {
    expect(monthLabel('2026-10')).toBe('October 2026');
    expect(dateLabel('2026-10-31')).toBe('31 Oct 2026');
    expect(dateLabel('2026-01-01')).toBe('1 Jan 2026');
  });
});

// Money helpers that work on decimal STRINGS only. No value is ever converted to a JS
// number, so there is no floating-point rounding (0.1 + 0.2 problems) anywhere in the UI.

const AMOUNT = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

/** Same rule as the API: a positive amount, at most 2 decimals and 9999999999.99. */
const MONEY_INPUT = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;

export function isMoneyInput(value: string): boolean {
  return MONEY_INPUT.test(value) && /[1-9]/.test(value);
}

/** Groups an integer string the Indian way: last 3 digits, then pairs (12,34,56,789). */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const lastThree = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const pairs: string[] = [];
  while (rest.length > 2) {
    pairs.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) pairs.unshift(rest);
  return `${pairs.join(',')},${lastThree}`;
}

/**
 * "1234567.5" → "₹12,34,567.50"; "-1500.5" → "−₹1,500.50".
 * Purely string manipulation. Unparseable input is returned unchanged rather than guessed.
 */
export function formatInr(amount: string): string {
  const match = AMOUNT.exec(amount);
  if (!match) return amount;
  const [, sign = '', integer = '0', fraction = ''] = match;
  const integerPart = groupIndian(integer.replace(/^0+(?=\d)/, ''));
  const formatted = `₹${integerPart}.${fraction.padEnd(2, '0')}`;
  const isZero = /^[0.]*$/.test(`${integer}${fraction}`);
  return sign && !isZero ? `−${formatted}` : formatted;
}

/** True when a money string is negative (for styling only). */
export function isNegative(amount: string): boolean {
  return amount.startsWith('-') && /[1-9]/.test(amount);
}

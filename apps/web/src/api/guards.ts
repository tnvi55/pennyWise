// Runtime checks for API responses. TypeScript types disappear at runtime, so data
// arriving over the network is checked before the UI trusts it.
import type {
  Category,
  CategoryExpense,
  Kind,
  PageMeta,
  Summary,
  Transaction,
  TransactionPage,
} from './types';

type Guard<T> = (value: unknown) => value is T;

const MONEY = /^-?\d+\.\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const isString = (value: unknown): value is string => typeof value === 'string';
const isMoney = (value: unknown): value is string => isString(value) && MONEY.test(value);
const isKind = (value: unknown): value is Kind => value === 'INCOME' || value === 'EXPENSE';
const isCount = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;

export function isCategory(value: unknown): value is Category {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isKind(value.type) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

export function isTransaction(value: unknown): value is Transaction {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isKind(value.type) &&
    isMoney(value.amount) &&
    isString(value.date) &&
    DATE.test(value.date) &&
    (value.note === null || isString(value.note)) &&
    isString(value.categoryId) &&
    isRecord(value.category) &&
    isString(value.category.id) &&
    isString(value.category.name) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

function isPageMeta(value: unknown): value is PageMeta {
  return (
    isRecord(value) &&
    isCount(value.page) &&
    isCount(value.pageSize) &&
    isCount(value.total) &&
    isCount(value.totalPages)
  );
}

export function isTransactionPage(value: unknown): value is TransactionPage {
  return isRecord(value) && arrayOf(isTransaction)(value.data) && isPageMeta(value.meta);
}

function isCategoryExpense(value: unknown): value is CategoryExpense {
  return (
    isRecord(value) &&
    isString(value.categoryId) &&
    isString(value.categoryName) &&
    isMoney(value.amount)
  );
}

export function isSummary(value: unknown): value is Summary {
  return (
    isRecord(value) &&
    isString(value.month) &&
    value.currency === 'INR' &&
    isMoney(value.income) &&
    isMoney(value.expenses) &&
    isMoney(value.net) &&
    arrayOf(isCategoryExpense)(value.expensesByCategory)
  );
}

export function arrayOf<T>(guard: Guard<T>): Guard<T[]> {
  return (value: unknown): value is T[] => Array.isArray(value) && value.every(guard);
}

/** Reads `message` from the standard error body { statusCode, error, message }. */
export function errorMessages(body: unknown): string[] {
  if (!isRecord(body)) return [];
  const { message } = body;
  if (isString(message)) return [message];
  if (Array.isArray(message)) return message.filter(isString);
  return [];
}

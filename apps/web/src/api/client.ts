// A small typed wrapper around fetch for the PennyWise API.
import {
  arrayOf,
  errorMessages,
  isCategory,
  isSummary,
  isTransaction,
  isTransactionPage,
} from './guards';
import type {
  Category,
  Kind,
  NewTransaction,
  Summary,
  Transaction,
  TransactionChanges,
  TransactionFilters,
  TransactionPage,
} from './types';

/** VITE_API_BASE_URL is public build-time config (see .env.example); never put secrets in it. */
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(
  /\/$/,
  '',
);

/** An error answer from the API (status 4xx/5xx) or a network failure (status 0). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly messages: string[],
  ) {
    super(messages.join('; ') || `Request failed (${status})`);
    this.name = 'ApiError';
  }
}

type Guard<T> = (value: unknown) => value is T;

async function request<T>(path: string, init: RequestInit, guard: Guard<T> | null): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new ApiError(0, ['Cannot reach the PennyWise API. Is it running?']);
  }

  // 204 No Content (DELETE) has no body to read.
  const body: unknown =
    response.status === 204 ? undefined : await response.json().catch(() => undefined);

  if (!response.ok) {
    const messages = errorMessages(body);
    throw new ApiError(
      response.status,
      messages.length > 0 ? messages : [`Request failed (${response.status})`],
    );
  }
  if (guard === null) return undefined as T;
  if (!guard(body)) {
    throw new ApiError(response.status, ['The API returned data in an unexpected format.']);
  }
  return body;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

const json = (value: unknown): string => JSON.stringify(value);

export const api = {
  listCategories: (type?: Kind) =>
    request(`/categories${query({ type })}`, { method: 'GET' }, arrayOf(isCategory)),
  createCategory: (name: string, type: Kind): Promise<Category> =>
    request('/categories', { method: 'POST', body: json({ name, type }) }, isCategory),
  renameCategory: (id: string, name: string): Promise<Category> =>
    request(`/categories/${id}`, { method: 'PATCH', body: json({ name }) }, isCategory),
  deleteCategory: (id: string): Promise<void> =>
    request(`/categories/${id}`, { method: 'DELETE' }, null),

  listTransactions: (filters: TransactionFilters): Promise<TransactionPage> =>
    request(`/transactions${query({ ...filters })}`, { method: 'GET' }, isTransactionPage),
  createTransaction: (input: NewTransaction): Promise<Transaction> =>
    request('/transactions', { method: 'POST', body: json(input) }, isTransaction),
  updateTransaction: (id: string, changes: TransactionChanges): Promise<Transaction> =>
    request(`/transactions/${id}`, { method: 'PATCH', body: json(changes) }, isTransaction),
  deleteTransaction: (id: string): Promise<void> =>
    request(`/transactions/${id}`, { method: 'DELETE' }, null),

  getSummary: (month: string): Promise<Summary> =>
    request(`/summary${query({ month })}`, { method: 'GET' }, isSummary),
};

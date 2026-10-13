import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';

import type { Category, Summary, Transaction, TransactionPage } from '../api/types';

/** A request the code under test sent to the (fake) API. */
export interface SentRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
}

type Reply =
  { status: number; body?: unknown } | (() => Promise<{ status: number; body?: unknown }>);
type Handler = (request: SentRequest) => Reply | undefined;

/**
 * Replaces fetch with a fake API. Each handler gets the request and returns a reply,
 * or undefined to let the next handler try. Unhandled requests fail loudly.
 */
export function fakeApi(...handlers: Handler[]): SentRequest[] {
  const sent: SentRequest[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input);
      const request: SentRequest = {
        method: init?.method ?? 'GET',
        path: url.pathname.replace(/^\/api\/v1/, ''),
        query: url.searchParams,
        body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
      };
      sent.push(request);
      for (const handler of handlers) {
        const reply = handler(request);
        if (reply) {
          const { status, body } = typeof reply === 'function' ? await reply() : reply;
          return new Response(status === 204 ? null : JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      throw new Error(`Unhandled request in test: ${request.method} ${request.path}`);
    }),
  );
  return sent;
}

/** Matches one method + path, e.g. on('GET', '/categories', { status: 200, body: [] }). */
export function on(method: string, path: string, reply: Reply): Handler {
  return (request) => (request.method === method && request.path === path ? reply : undefined);
}

export function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// ---- Synthetic fixtures -------------------------------------------------------------

const STAMP = '2026-10-13T09:30:00.000Z';

export const categories: Category[] = [
  { id: 'c-rent', name: 'Rent', type: 'EXPENSE', createdAt: STAMP, updatedAt: STAMP },
  { id: 'c-groceries', name: 'Groceries', type: 'EXPENSE', createdAt: STAMP, updatedAt: STAMP },
  { id: 'c-salary', name: 'Salary', type: 'INCOME', createdAt: STAMP, updatedAt: STAMP },
];

export function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 't-1',
    type: 'EXPENSE',
    amount: '22000.00',
    date: '2026-10-02',
    note: null,
    categoryId: 'c-rent',
    category: { id: 'c-rent', name: 'Rent' },
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

export function page(
  rows: Transaction[],
  meta: Partial<TransactionPage['meta']> = {},
): TransactionPage {
  return {
    data: rows,
    meta: {
      page: 1,
      pageSize: 20,
      total: rows.length,
      totalPages: rows.length > 0 ? 1 : 0,
      ...meta,
    },
  };
}

export function summary(overrides: Partial<Summary> = {}): Summary {
  return {
    month: '2026-10',
    currency: 'INR',
    income: '86500.00',
    expenses: '23450.29',
    net: '63049.71',
    expensesByCategory: [
      { categoryId: 'c-rent', categoryName: 'Rent', amount: '22000.00' },
      { categoryId: 'c-groceries', categoryName: 'Groceries', amount: '0.30' },
    ],
    ...overrides,
  };
}

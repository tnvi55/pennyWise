import { describe, expect, it, vi } from 'vitest';

import { fakeApi, on, page, transaction } from '../test/helpers';
import { api, ApiError } from './client';

describe('api client', () => {
  it('returns checked JSON on success and sends filters as query parameters', async () => {
    const sent = fakeApi(on('GET', '/transactions', { status: 200, body: page([transaction()]) }));

    const result = await api.listTransactions({
      month: '2026-10',
      type: 'EXPENSE',
      page: 2,
      pageSize: 20,
    });

    expect(result.data[0]?.amount).toBe('22000.00');
    expect(Object.fromEntries(sent[0]?.query ?? [])).toEqual({
      month: '2026-10',
      type: 'EXPENSE',
      page: '2',
      pageSize: '20',
    });
  });

  it('turns a 400 body into an ApiError with the API messages', async () => {
    fakeApi(
      on('POST', '/transactions', {
        status: 400,
        body: {
          statusCode: 400,
          error: 'Bad Request',
          message: ['amount must be a positive decimal string'],
        },
      }),
    );

    const error = await api
      .createTransaction({
        type: 'EXPENSE',
        amount: '0',
        date: '2026-10-01',
        note: null,
        categoryId: 'c',
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      messages: ['amount must be a positive decimal string'],
    });
  });

  it('reads a single-string message (409)', async () => {
    fakeApi(
      on('DELETE', '/categories/c-rent', {
        status: 409,
        body: { statusCode: 409, error: 'Conflict', message: 'Category is used' },
      }),
    );
    await expect(api.deleteCategory('c-rent')).rejects.toMatchObject({
      status: 409,
      messages: ['Category is used'],
    });
  });

  it('accepts 204 No Content for deletes', async () => {
    fakeApi(on('DELETE', '/transactions/t-1', { status: 204 }));
    await expect(api.deleteTransaction('t-1')).resolves.toBeUndefined();
  });

  it('rejects a success response with an unexpected shape', async () => {
    fakeApi(on('GET', '/summary', { status: 200, body: { month: '2026-10', income: 86500 } }));
    await expect(api.getSummary('2026-10')).rejects.toMatchObject({
      messages: ['The API returned data in an unexpected format.'],
    });
  });

  it('rejects amounts that are numbers instead of strings', async () => {
    fakeApi(
      on('GET', '/transactions', {
        status: 200,
        body: page([{ ...transaction(), amount: 22000 } as never]),
      }),
    );
    await expect(api.listTransactions({ page: 1, pageSize: 20 })).rejects.toBeInstanceOf(ApiError);
  });

  it('reports a network failure clearly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api.listCategories()).rejects.toMatchObject({
      status: 0,
      messages: ['Cannot reach the PennyWise API. Is it running?'],
    });
  });
});

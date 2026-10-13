import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { SentRequest } from '../../test/helpers';
import { categories, fakeApi, on, page, renderWithQuery, transaction } from '../../test/helpers';
import { TransactionsView } from './TransactionsView';

const listCalls = (sent: SentRequest[]) =>
  sent
    .filter((r) => r.method === 'GET' && r.path === '/transactions')
    .map((r) => Object.fromEntries(r.query));

describe('TransactionsView', () => {
  it('shows a loading state, then the rows with formatted amounts', async () => {
    fakeApi(
      on('GET', '/categories', { status: 200, body: categories }),
      on('GET', '/transactions', {
        status: 200,
        body: page([
          transaction({
            id: 't-2',
            amount: '0.10',
            date: '2026-10-03',
            note: 'Decimal check',
            category: { id: 'c-groceries', name: 'Groceries' },
          }),
          transaction(),
        ]),
      }),
    );
    renderWithQuery(<TransactionsView initialMonth="2026-10" />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading transactions…');
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('3 Oct 2026GroceriesDecimal check−₹0.10');
    expect(rows[2]).toHaveTextContent('2 Oct 2026Rent—−₹22,000.00');
    expect(screen.getByText('Page 1 of 1 · 2 transactions')).toBeInTheDocument();
  });

  it('shows an empty state for a month without transactions', async () => {
    fakeApi(
      on('GET', '/categories', { status: 200, body: categories }),
      on('GET', '/transactions', { status: 200, body: page([]) }),
    );
    renderWithQuery(<TransactionsView initialMonth="2025-01" />);

    expect(
      await screen.findByText('No transactions in January 2025 match these filters.'),
    ).toBeInTheDocument();
  });

  it('shows the error and retries on request', async () => {
    let fail = true;
    fakeApi(on('GET', '/categories', { status: 200, body: categories }), (request) =>
      request.path === '/transactions'
        ? fail
          ? {
              status: 500,
              body: {
                statusCode: 500,
                error: 'Internal Server Error',
                message: 'Internal server error',
              },
            }
          : { status: 200, body: page([transaction()]) }
        : undefined,
    );
    const user = userEvent.setup();
    renderWithQuery(<TransactionsView initialMonth="2026-10" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('refetches with the chosen filters and resets to page 1', async () => {
    const sent = fakeApi(
      on('GET', '/categories', { status: 200, body: categories }),
      on('GET', '/transactions', {
        status: 200,
        body: page([transaction()], { total: 45, totalPages: 3 }),
      }),
    );
    const user = userEvent.setup();
    renderWithQuery(<TransactionsView initialMonth="2026-10" />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(listCalls(sent).at(-1)).toMatchObject({ page: '2' }));

    await user.selectOptions(screen.getByLabelText('Type'), 'Expense');
    await waitFor(() =>
      expect(listCalls(sent).at(-1)).toEqual({
        month: '2026-10',
        type: 'EXPENSE',
        page: '1',
        pageSize: '20',
      }),
    );

    await user.selectOptions(
      screen.getByLabelText('Category', { selector: '#filter-category' }),
      'Rent (expense)',
    );
    await waitFor(() =>
      expect(listCalls(sent).at(-1)).toMatchObject({ categoryId: 'c-rent', page: '1' }),
    );
  });

  it('deletes after confirmation, refetches and keeps the filters', async () => {
    let rows = [transaction()];
    const sent = fakeApi(
      on('GET', '/categories', { status: 200, body: categories }),
      (request) =>
        request.method === 'GET' && request.path === '/transactions'
          ? { status: 200, body: page(rows) }
          : undefined,
      (request) => {
        if (request.method !== 'DELETE') return undefined;
        rows = [];
        return { status: 204 };
      },
    );
    const user = userEvent.setup();
    renderWithQuery(<TransactionsView initialMonth="2026-10" />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Delete Rent on 2 Oct 2026' }));
    expect(sent.some((r) => r.method === 'DELETE')).toBe(false); // first click only asks
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(await screen.findByText('Transaction deleted.')).toBeInTheDocument();
    expect(
      await screen.findByText('No transactions in October 2026 match these filters.'),
    ).toBeInTheDocument();
    expect(sent.find((r) => r.method === 'DELETE')?.path).toBe('/transactions/t-1');
    expect(listCalls(sent).at(-1)).toMatchObject({ month: '2026-10' });
  });

  it('opens the edit form with the row values', async () => {
    fakeApi(
      on('GET', '/categories', { status: 200, body: categories }),
      on('GET', '/transactions', { status: 200, body: page([transaction()]) }),
    );
    const user = userEvent.setup();
    renderWithQuery(<TransactionsView initialMonth="2026-10" />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Edit Rent on 2 Oct 2026' }));

    const form = screen.getByRole('form', { name: 'Edit transaction' });
    expect(within(form).getByLabelText('Amount (₹)')).toHaveValue('22000.00');
    await user.click(within(form).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('form', { name: 'Add transaction' })).toBeInTheDocument();
  });
});

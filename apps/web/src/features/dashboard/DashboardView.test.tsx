import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { fakeApi, on, renderWithQuery, summary } from '../../test/helpers';
import { DashboardView } from './DashboardView';

describe('DashboardView', () => {
  it('shows the monthly totals and the breakdown, formatted in INR', async () => {
    const sent = fakeApi(on('GET', '/summary', { status: 200, body: summary() }));
    renderWithQuery(<DashboardView initialMonth="2026-10" />);

    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading summary…');
    expect(await screen.findByText('₹86,500.00')).toBeInTheDocument();
    expect(screen.getByText('₹23,450.29')).toBeInTheDocument();
    expect(screen.getByText('₹63,049.71')).toBeInTheDocument();
    expect(screen.getByText('Rent').nextSibling).toHaveTextContent('₹22,000.00');
    expect(screen.getByText('Groceries').nextSibling).toHaveTextContent('₹0.30');
    expect(sent[0]?.query.get('month')).toBe('2026-10');
  });

  it('shows zeros and an empty breakdown for a month without data', async () => {
    fakeApi(
      on('GET', '/summary', {
        status: 200,
        body: summary({
          month: '2025-01',
          income: '0.00',
          expenses: '0.00',
          net: '0.00',
          expensesByCategory: [],
        }),
      }),
    );
    renderWithQuery(<DashboardView initialMonth="2025-01" />);

    expect(await screen.findByText('No expenses in January 2025.')).toBeInTheDocument();
    expect(screen.getAllByText('₹0.00')).toHaveLength(3);
  });

  it('shows a negative net balance with a minus sign', async () => {
    fakeApi(
      on('GET', '/summary', {
        status: 200,
        body: summary({ income: '0.00', expenses: '1500.50', net: '-1500.50' }),
      }),
    );
    renderWithQuery(<DashboardView initialMonth="2026-10" />);

    expect(await screen.findByText('−₹1,500.50')).toBeInTheDocument();
  });

  it('loads another month when the month picker changes', async () => {
    const sent = fakeApi((request) =>
      request.path === '/summary'
        ? { status: 200, body: summary({ month: request.query.get('month') ?? '' }) }
        : undefined,
    );
    renderWithQuery(<DashboardView initialMonth="2026-10" />);
    await screen.findByText('₹86,500.00');

    // jsdom has no month-picker UI, so set the value directly as the browser would.
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-09' } });

    expect(await screen.findByRole('heading', { name: 'September 2026' })).toBeInTheDocument();
    await waitFor(() => expect(sent.at(-1)?.query.get('month')).toBe('2026-09'));
  });

  it('shows an API error with a Retry button', async () => {
    fakeApi(
      on('GET', '/summary', {
        status: 500,
        body: { statusCode: 500, error: 'Internal Server Error', message: 'Internal server error' },
      }),
    );
    renderWithQuery(<DashboardView initialMonth="2026-10" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

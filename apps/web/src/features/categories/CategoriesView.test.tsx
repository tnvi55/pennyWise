import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { Category } from '../../api/types';
import { categories, fakeApi, on, renderWithQuery } from '../../test/helpers';
import { CategoriesView } from './CategoriesView';

describe('CategoriesView', () => {
  it('lists categories grouped by type', async () => {
    fakeApi(on('GET', '/categories', { status: 200, body: categories }));
    renderWithQuery(<CategoriesView />);

    const expenses = await screen.findByRole('region', { name: 'Expense categories' });
    expect(
      within(expenses)
        .getAllByRole('listitem')
        .map((li) => li.textContent?.split('Rename')[0]),
    ).toEqual(['Rent', 'Groceries']);
    expect(
      within(screen.getByRole('region', { name: 'Income categories' })).getByText('Salary'),
    ).toBeInTheDocument();
  });

  it('adds a category with a trimmed name and refreshes the list', async () => {
    let list: Category[] = [...categories];
    const sent = fakeApi(
      (request) => (request.method === 'GET' ? { status: 200, body: list } : undefined),
      (request) => {
        if (request.method !== 'POST') return undefined;
        const created: Category = { ...categories[0]!, id: 'c-new', name: 'Books' };
        list = [...list, created];
        return { status: 201, body: created };
      },
    );
    const user = userEvent.setup();
    renderWithQuery(<CategoriesView />);
    await screen.findByText('Rent');

    await user.type(screen.getByLabelText('Name'), '  Books ');
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    expect(await screen.findByText('Category "Books" added.')).toBeInTheDocument();
    expect(sent.find((r) => r.method === 'POST')?.body).toEqual({ name: 'Books', type: 'EXPENSE' });
    expect(await screen.findByText('Books')).toBeInTheDocument();
  });

  it('requires a name before calling the API', async () => {
    const sent = fakeApi(on('GET', '/categories', { status: 200, body: categories }));
    const user = userEvent.setup();
    renderWithQuery(<CategoriesView />);
    await screen.findByText('Rent');

    await user.click(screen.getByRole('button', { name: 'Add category' }));

    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Enter a name.');
    expect(sent.filter((r) => r.method === 'POST')).toHaveLength(0);
  });

  it('shows the 409 message for a duplicate category', async () => {
    fakeApi(
      on('GET', '/categories', { status: 200, body: categories }),
      on('POST', '/categories', {
        status: 409,
        body: {
          statusCode: 409,
          error: 'Conflict',
          message: 'Category "Rent" (EXPENSE) already exists',
        },
      }),
    );
    const user = userEvent.setup();
    renderWithQuery(<CategoriesView />);
    await screen.findByText('Groceries');

    await user.type(screen.getByLabelText('Name'), 'Rent');
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Category "Rent" (EXPENSE) already exists',
    );
  });

  it('renames a category inline', async () => {
    const sent = fakeApi(
      on('GET', '/categories', { status: 200, body: categories }),
      on('PATCH', '/categories/c-rent', {
        status: 200,
        body: { ...categories[0], name: 'Housing' },
      }),
    );
    const user = userEvent.setup();
    renderWithQuery(<CategoriesView />);
    await screen.findByText('Rent');

    await user.click(screen.getByRole('button', { name: 'Rename Rent' }));
    const input = screen.getByLabelText('New name for Rent');
    await user.clear(input);
    await user.type(input, 'Housing');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Renamed to "Housing".')).toBeInTheDocument();
    expect(sent.find((r) => r.method === 'PATCH')?.body).toEqual({ name: 'Housing' });
  });

  it('explains why a category that is still used cannot be deleted', async () => {
    const sent = fakeApi(
      on('GET', '/categories', { status: 200, body: categories }),
      on('DELETE', '/categories/c-rent', {
        status: 409,
        body: {
          statusCode: 409,
          error: 'Conflict',
          message: 'Category is used by one or more transactions and cannot be deleted',
        },
      }),
    );
    const user = userEvent.setup();
    renderWithQuery(<CategoriesView />);
    await screen.findByText('Rent');

    await user.click(screen.getByRole('button', { name: 'Delete Rent' }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Category is used by one or more transactions and cannot be deleted',
    );
    await waitFor(() => expect(sent.filter((r) => r.method === 'DELETE')).toHaveLength(1));
    expect(screen.getByText('Rent')).toBeInTheDocument();
  });
});

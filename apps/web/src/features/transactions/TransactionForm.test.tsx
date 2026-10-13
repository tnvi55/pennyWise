import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { categories, fakeApi, on, renderWithQuery, transaction } from '../../test/helpers';
import { TransactionForm } from './TransactionForm';

function renderForm(props: Partial<Parameters<typeof TransactionForm>[0]> = {}) {
  const onDone = vi.fn();
  renderWithQuery(<TransactionForm categories={categories} onDone={onDone} {...props} />);
  return { onDone, user: userEvent.setup() };
}

describe('TransactionForm', () => {
  it('shows field errors and sends nothing when the input is invalid', async () => {
    const sent = fakeApi();
    const { user } = renderForm();

    await user.type(screen.getByLabelText('Amount (₹)'), '12.345');
    await user.click(screen.getByRole('button', { name: 'Add transaction' }));

    expect(screen.getByLabelText('Amount (₹)')).toHaveAccessibleDescription(
      'Enter a positive amount with at most 2 decimals, e.g. 125.50.',
    );
    expect(screen.getByLabelText('Amount (₹)')).toBeInvalid();
    expect(screen.getByLabelText('Category')).toHaveAccessibleDescription('Choose a category.');
    expect(sent).toHaveLength(0);
  });

  it.each(['0', '-5', '1e3', '01.5'])(
    'rejects the amount %p before calling the API',
    async (amount) => {
      const sent = fakeApi();
      const { user } = renderForm();

      await user.type(screen.getByLabelText('Amount (₹)'), amount);
      await user.selectOptions(screen.getByLabelText('Category'), 'Rent');
      await user.click(screen.getByRole('button', { name: 'Add transaction' }));

      expect(screen.getByLabelText('Amount (₹)')).toBeInvalid();
      expect(sent).toHaveLength(0);
    },
  );

  it('only offers categories of the selected type', async () => {
    fakeApi();
    const { user } = renderForm();
    const options = () =>
      within(screen.getByLabelText('Category'))
        .getAllByRole('option')
        .map((option) => option.textContent);

    expect(options()).toEqual(['Choose…', 'Rent', 'Groceries']);
    await user.click(screen.getByRole('radio', { name: 'Income' }));
    expect(options()).toEqual(['Choose…', 'Salary']);
  });

  it('clears the chosen category when the type changes to one it does not match', async () => {
    fakeApi();
    const { user } = renderForm();

    await user.selectOptions(screen.getByLabelText('Category'), 'Rent');
    await user.click(screen.getByRole('radio', { name: 'Income' }));

    expect(screen.getByLabelText('Category')).toHaveValue('');
  });

  it('creates a transaction with the amount as a string and a trimmed note', async () => {
    const sent = fakeApi(on('POST', '/transactions', { status: 201, body: transaction() }));
    const { user, onDone } = renderForm();

    await user.type(screen.getByLabelText('Amount (₹)'), '125.5');
    await user.clear(screen.getByLabelText('Date'));
    await user.type(screen.getByLabelText('Date'), '2026-10-03');
    await user.selectOptions(screen.getByLabelText('Category'), 'Groceries');
    await user.type(screen.getByLabelText('Note (optional)'), '  Weekly shop  ');
    await user.click(screen.getByRole('button', { name: 'Add transaction' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('Transaction added.'));
    expect(sent[0]?.body).toEqual({
      type: 'EXPENSE',
      amount: '125.5',
      date: '2026-10-03',
      categoryId: 'c-groceries',
      note: 'Weekly shop',
    });
    expect(screen.getByLabelText('Amount (₹)')).toHaveValue('');
  });

  it('shows the server validation message when the API rejects the request', async () => {
    fakeApi(
      on('POST', '/transactions', {
        status: 400,
        body: {
          statusCode: 400,
          error: 'Bad Request',
          message: 'Category "Rent" is EXPENSE but the transaction is INCOME',
        },
      }),
    );
    const { user, onDone } = renderForm();

    await user.type(screen.getByLabelText('Amount (₹)'), '10');
    await user.selectOptions(screen.getByLabelText('Category'), 'Rent');
    await user.click(screen.getByRole('button', { name: 'Add transaction' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Category "Rent" is EXPENSE but the transaction is INCOME',
    );
    expect(onDone).not.toHaveBeenCalled();
  });

  it('sends only one request when submitted twice quickly', async () => {
    let finish: () => void = () => undefined;
    const sent = fakeApi(
      on(
        'POST',
        '/transactions',
        () =>
          new Promise((resolve) => {
            finish = () => resolve({ status: 201, body: transaction() });
          }),
      ),
    );
    const { user, onDone } = renderForm();

    await user.type(screen.getByLabelText('Amount (₹)'), '10');
    await user.selectOptions(screen.getByLabelText('Category'), 'Rent');
    await user.dblClick(screen.getByRole('button', { name: 'Add transaction' }));

    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
    finish();
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(sent.filter((r) => r.method === 'POST')).toHaveLength(1);
  });

  it('edits: pre-fills the form and sends only the changed fields', async () => {
    const existing = transaction({ note: 'October rent' });
    const sent = fakeApi(
      on('PATCH', '/transactions/t-1', { status: 200, body: { ...existing, amount: '21000.00' } }),
    );
    const { user, onDone } = renderForm({ existing });

    expect(screen.getByLabelText('Amount (₹)')).toHaveValue('22000.00');
    expect(screen.getByLabelText('Note (optional)')).toHaveValue('October rent');

    await user.clear(screen.getByLabelText('Amount (₹)'));
    await user.type(screen.getByLabelText('Amount (₹)'), '21000');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('Transaction updated.'));
    expect(sent[0]).toMatchObject({ method: 'PATCH', body: { amount: '21000' } });
  });

  it('edits: clearing the note sends note: null', async () => {
    const existing = transaction({ note: 'temporary' });
    const sent = fakeApi(
      on('PATCH', '/transactions/t-1', { status: 200, body: { ...existing, note: null } }),
    );
    const { user } = renderForm({ existing });

    await user.clear(screen.getByLabelText('Note (optional)'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.body).toEqual({ note: null });
  });

  it('edits: says so instead of sending an empty update', async () => {
    const sent = fakeApi();
    const { user } = renderForm({ existing: transaction() });

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByRole('status')).toHaveTextContent('Nothing has changed.');
    expect(sent).toHaveLength(0);
  });
});

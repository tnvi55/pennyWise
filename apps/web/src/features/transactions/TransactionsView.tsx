import { useState } from 'react';

import { useCategories, useDeleteTransaction, useTransactions } from '../../api/queries';
import type { Category, Kind, Transaction, TransactionFilters } from '../../api/types';
import { ConfirmButton } from '../../components/ConfirmButton';
import { inputClass, secondaryButtonClass } from '../../components/fields';
import { MonthPicker } from '../../components/MonthPicker';
import { Empty, ErrorMessage, Loading, SuccessMessage } from '../../components/StatusMessage';
import { currentMonth, dateLabel, monthLabel } from '../../lib/dates';
import { formatInr } from '../../lib/money';
import { TransactionForm } from './TransactionForm';

const PAGE_SIZE = 20;

export function TransactionsView({ initialMonth = currentMonth() }: { initialMonth?: string }) {
  // Filters live here, so they survive adding, editing and deleting transactions.
  const [filters, setFilters] = useState<TransactionFilters>({
    month: initialMonth,
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const categories = useCategories();
  const transactions = useTransactions(filters);
  const remove = useDeleteTransaction();

  /** Any filter change goes back to page 1. */
  function filter(changes: Partial<TransactionFilters>) {
    setFilters((current) => ({ ...current, ...changes, page: 1 }));
    setMessage(null);
  }

  const categoryList = categories.data ?? [];

  return (
    <section aria-labelledby="transactions-heading" className="flex flex-col gap-6">
      <h2 id="transactions-heading" className="text-xl font-semibold text-slate-900">
        Transactions
      </h2>

      {categories.isError && (
        <ErrorMessage error={categories.error} onRetry={() => void categories.refetch()} />
      )}
      {categories.isSuccess &&
        (editing ? (
          <TransactionForm
            key={editing.id}
            categories={categoryList}
            existing={editing}
            onDone={(text) => {
              setEditing(null);
              setMessage(text);
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <TransactionForm categories={categoryList} onDone={setMessage} />
        ))}

      {message && <SuccessMessage>{message}</SuccessMessage>}

      <Filters filters={filters} categories={categoryList} onChange={filter} />

      {transactions.isPending && <Loading label="Loading transactions…" />}
      {transactions.isError && (
        <ErrorMessage error={transactions.error} onRetry={() => void transactions.refetch()} />
      )}
      {remove.isError && <ErrorMessage error={remove.error} />}
      {transactions.isSuccess &&
        (transactions.data.data.length === 0 ? (
          <Empty>
            No transactions{filters.month ? ` in ${monthLabel(filters.month)}` : ''} match these
            filters.
          </Empty>
        ) : (
          <>
            <TransactionTable
              rows={transactions.data.data}
              deletingId={remove.isPending ? remove.variables : undefined}
              onEdit={(row) => {
                setEditing(row);
                setMessage(null);
              }}
              onDelete={(row) =>
                remove.mutate(row.id, {
                  onSuccess: () => {
                    if (editing?.id === row.id) setEditing(null);
                    setMessage('Transaction deleted.');
                  },
                })
              }
            />
            <Pagination
              page={transactions.data.meta.page}
              totalPages={transactions.data.meta.totalPages}
              total={transactions.data.meta.total}
              onPage={(page) => setFilters((current) => ({ ...current, page }))}
            />
          </>
        ))}
    </section>
  );
}

interface FiltersProps {
  filters: TransactionFilters;
  categories: Category[];
  onChange: (changes: Partial<TransactionFilters>) => void;
}

function Filters({ filters, categories, onChange }: FiltersProps) {
  const choices = filters.type ? categories.filter((c) => c.type === filters.type) : categories;
  return (
    <fieldset className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
      <legend className="px-1 text-sm font-semibold text-slate-700">Filters</legend>
      <MonthPicker
        id="filter-month"
        value={filters.month ?? ''}
        onChange={(month) => onChange({ month })}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-type" className="text-sm font-medium text-slate-700">
          Type
        </label>
        <select
          id="filter-type"
          value={filters.type ?? ''}
          onChange={(event) => {
            const type = (event.target.value || undefined) as Kind | undefined;
            const keepCategory = categories.some(
              (c) => c.id === filters.categoryId && (!type || c.type === type),
            );
            onChange({ type, categoryId: keepCategory ? filters.categoryId : undefined });
          }}
          className={inputClass}
        >
          <option value="">All</option>
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-category" className="text-sm font-medium text-slate-700">
          Category
        </label>
        <select
          id="filter-category"
          value={filters.categoryId ?? ''}
          onChange={(event) => onChange({ categoryId: event.target.value || undefined })}
          className={inputClass}
        >
          <option value="">All</option>
          {choices.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} ({category.type === 'INCOME' ? 'income' : 'expense'})
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => onChange({ month: undefined, type: undefined, categoryId: undefined })}
        >
          Show all months
        </button>
      </div>
    </fieldset>
  );
}

interface TableProps {
  rows: Transaction[];
  deletingId?: string;
  onEdit: (row: Transaction) => void;
  onDelete: (row: Transaction) => void;
}

function TransactionTable({ rows, deletingId, onEdit, onDelete }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">Transactions, newest first</caption>
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              Date
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Category
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Note
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Amount
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="whitespace-nowrap px-4 py-2">{dateLabel(row.date)}</td>
              <td className="px-4 py-2">{row.category.name}</td>
              <td className="px-4 py-2 text-slate-600">{row.note ?? '—'}</td>
              <td
                className={`whitespace-nowrap px-4 py-2 text-right font-medium tabular-nums ${row.type === 'INCOME' ? 'text-emerald-700' : 'text-red-700'}`}
              >
                {row.type === 'INCOME' ? '+' : '−'}
                {formatInr(row.amount)}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right">
                <button
                  type="button"
                  aria-label={`Edit ${row.category.name} on ${dateLabel(row.date)}`}
                  onClick={() => onEdit(row)}
                  className="rounded-md px-2 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                >
                  Edit
                </button>
                <ConfirmButton
                  label="Delete"
                  accessibleLabel={`Delete ${row.category.name} on ${dateLabel(row.date)}`}
                  pending={deletingId === row.id}
                  onConfirm={() => onDelete(row)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
}

function Pagination({ page, totalPages, total, onPage }: PaginationProps) {
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between text-sm text-slate-600"
    >
      <span>
        Page {page} of {Math.max(totalPages, 1)} · {total} transaction{total === 1 ? '' : 's'}
      </span>
      <span className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className={secondaryButtonClass}
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className={secondaryButtonClass}
        >
          Next
        </button>
      </span>
    </nav>
  );
}

import { useState } from 'react';

import { useSummary } from '../../api/queries';
import type { Summary } from '../../api/types';
import { MonthPicker } from '../../components/MonthPicker';
import { Empty, ErrorMessage, Loading } from '../../components/StatusMessage';
import { currentMonth, monthLabel } from '../../lib/dates';
import { formatInr, isNegative } from '../../lib/money';

export function DashboardView({ initialMonth = currentMonth() }: { initialMonth?: string }) {
  const [month, setMonth] = useState(initialMonth);
  const summary = useSummary(month);

  return (
    <section aria-labelledby="dashboard-heading" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="dashboard-heading" className="text-xl font-semibold text-slate-900">
          {monthLabel(month)}
        </h2>
        <div className="w-48">
          <MonthPicker id="dashboard-month" value={month} onChange={setMonth} />
        </div>
      </div>

      {summary.isPending && <Loading label="Loading summary…" />}
      {summary.isError && (
        <ErrorMessage error={summary.error} onRetry={() => void summary.refetch()} />
      )}
      {summary.isSuccess && (
        <>
          <SummaryCards summary={summary.data} />
          <ExpenseBreakdown summary={summary.data} />
        </>
      )}
    </section>
  );
}

function SummaryCards({ summary }: { summary: Summary }) {
  const cards = [
    { label: 'Income', value: summary.income, tone: 'text-emerald-700' },
    { label: 'Expenses', value: summary.expenses, tone: 'text-red-700' },
    {
      label: 'Net balance',
      value: summary.net,
      tone: isNegative(summary.net) ? 'text-red-700' : 'text-slate-900',
    },
  ];
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <dt className="text-sm text-slate-500">{card.label}</dt>
          <dd className={`mt-1 text-2xl font-semibold tabular-nums ${card.tone}`}>
            {formatInr(card.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ExpenseBreakdown({ summary }: { summary: Summary }) {
  const rows = summary.expensesByCategory;
  // Bar widths are presentation only; the amounts shown are the exact strings from the API.
  const largest = Math.max(...rows.map((row) => Number(row.amount)), 0);

  return (
    <section
      aria-labelledby="breakdown-heading"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h3 id="breakdown-heading" className="mb-3 font-semibold text-slate-900">
        Expenses by category
      </h3>
      {rows.length === 0 ? (
        <Empty>No expenses in {monthLabel(summary.month)}.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.categoryId}>
              <div className="flex justify-between text-sm">
                <span className="text-slate-700">{row.categoryName}</span>
                <span className="font-medium tabular-nums text-slate-900">
                  {formatInr(row.amount)}
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100" aria-hidden="true">
                <div
                  className="h-2 rounded-full bg-red-400"
                  style={{
                    width: `${largest > 0 ? Math.max((Number(row.amount) / largest) * 100, 1) : 0}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

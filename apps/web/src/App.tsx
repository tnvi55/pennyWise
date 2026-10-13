import { useEffect, useState } from 'react';

import { CategoriesView } from './features/categories/CategoriesView';
import { DashboardView } from './features/dashboard/DashboardView';
import { TransactionsView } from './features/transactions/TransactionsView';

const VIEWS = {
  dashboard: { label: 'Dashboard', render: () => <DashboardView /> },
  transactions: { label: 'Transactions', render: () => <TransactionsView /> },
  categories: { label: 'Categories', render: () => <CategoriesView /> },
} as const;

type View = keyof typeof VIEWS;

function isView(value: string): value is View {
  return value in VIEWS;
}

/** A tiny hash router: #/transactions shows the transactions view; Back and Forward work. */
function viewFromHash(): View {
  const name = window.location.hash.replace(/^#\/?/, '');
  return isView(name) ? name : 'dashboard';
}

function useHashView(): View {
  const [view, setView] = useState<View>(viewFromHash);
  useEffect(() => {
    const onChange = () => setView(viewFromHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return view;
}

export function App() {
  const view = useHashView();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <h1 className="text-lg font-bold text-emerald-700">PennyWise</h1>
          <nav aria-label="Main">
            <ul className="flex gap-1">
              {(Object.keys(VIEWS) as View[]).map((name) => (
                <li key={name}>
                  <a
                    href={`#/${name}`}
                    aria-current={view === name ? 'page' : undefined}
                    className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 aria-[current=page]:bg-emerald-50 aria-[current=page]:text-emerald-800"
                  >
                    {VIEWS[name].label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{VIEWS[view].render()}</main>
    </div>
  );
}

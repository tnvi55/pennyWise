// Shapes of the PennyWise API (docs/api-design.md). Money values are always strings.

export type Kind = 'INCOME' | 'EXPENSE';
export const KINDS: readonly Kind[] = ['INCOME', 'EXPENSE'];

export interface Category {
  id: string;
  name: string;
  type: Kind;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  type: Kind;
  /** Decimal string with exactly 2 decimals, e.g. "125.50". */
  amount: string;
  /** Calendar date, YYYY-MM-DD. */
  date: string;
  note: string | null;
  categoryId: string;
  category: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface TransactionPage {
  data: Transaction[];
  meta: PageMeta;
}

export interface CategoryExpense {
  categoryId: string;
  categoryName: string;
  amount: string;
}

export interface Summary {
  month: string;
  currency: 'INR';
  income: string;
  expenses: string;
  net: string;
  expensesByCategory: CategoryExpense[];
}

export interface TransactionFilters {
  month?: string;
  type?: Kind;
  categoryId?: string;
  page: number;
  pageSize: number;
}

export interface NewTransaction {
  type: Kind;
  amount: string;
  date: string;
  note: string | null;
  categoryId: string;
}

export type TransactionChanges = Partial<NewTransaction>;

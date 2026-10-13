// TanStack Query hooks. Query keys name the cached data; after a successful change,
// invalidating a key makes every screen showing that data refetch it.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import type { Kind, NewTransaction, TransactionChanges, TransactionFilters } from './types';

export const keys = {
  categories: ['categories'] as const,
  transactions: ['transactions'] as const,
  transactionList: (filters: TransactionFilters) => ['transactions', filters] as const,
  summary: ['summary'] as const,
  summaryFor: (month: string) => ['summary', month] as const,
};

export function useCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: () => api.listCategories() });
}

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: keys.transactionList(filters),
    queryFn: () => api.listTransactions(filters),
    // Keep showing the current page while the next one loads, instead of flashing "Loading".
    placeholderData: keepPreviousData,
  });
}

export function useSummary(month: string) {
  return useQuery({ queryKey: keys.summaryFor(month), queryFn: () => api.getSummary(month) });
}

/** Any transaction change can alter lists and monthly totals, so both are refetched. */
function useInvalidateMoney() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.transactions }),
      client.invalidateQueries({ queryKey: keys.summary }),
    ]);
}

export function useCreateTransaction() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (input: NewTransaction) => api.createTransaction(input),
    onSuccess: invalidate,
  });
}

export function useUpdateTransaction() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: TransactionChanges }) =>
      api.updateTransaction(id, changes),
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (id: string) => api.deleteTransaction(id),
    onSuccess: invalidate,
  });
}

/** Category changes affect the category list and the names shown in transactions and the summary. */
function useInvalidateCategories() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.categories }),
      client.invalidateQueries({ queryKey: keys.transactions }),
      client.invalidateQueries({ queryKey: keys.summary }),
    ]);
}

export function useCreateCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: ({ name, type }: { name: string; type: Kind }) => api.createCategory(name, type),
    onSuccess: invalidate,
  });
}

export function useRenameCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.renameCategory(id, name),
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({ mutationFn: (id: string) => api.deleteCategory(id), onSuccess: invalidate });
}

import type { FormEvent } from 'react';
import { useState } from 'react';

import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useRenameCategory,
} from '../../api/queries';
import type { Category, Kind } from '../../api/types';
import { ConfirmButton } from '../../components/ConfirmButton';
import { buttonClass, Field, inputClass, secondaryButtonClass } from '../../components/fields';
import { describedBy } from '../../lib/aria';
import { Empty, ErrorMessage, Loading, SuccessMessage } from '../../components/StatusMessage';

const NAME_MAX = 80;

function nameError(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed === '') return 'Enter a name.';
  if (trimmed.length > NAME_MAX) return `Keep the name to ${NAME_MAX} characters or fewer.`;
  return undefined;
}

export function CategoriesView() {
  const categories = useCategories();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <section aria-labelledby="categories-heading" className="flex flex-col gap-6">
      <h2 id="categories-heading" className="text-xl font-semibold text-slate-900">
        Categories
      </h2>
      <NewCategoryForm onDone={setMessage} />
      {message && <SuccessMessage>{message}</SuccessMessage>}

      {categories.isPending && <Loading label="Loading categories…" />}
      {categories.isError && (
        <ErrorMessage error={categories.error} onRetry={() => void categories.refetch()} />
      )}
      {categories.isSuccess && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {(['EXPENSE', 'INCOME'] as const).map((type) => (
            <CategoryGroup
              key={type}
              type={type}
              rows={categories.data.filter((c) => c.type === type)}
              onMessage={setMessage}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function NewCategoryForm({ onDone }: { onDone: (message: string) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<Kind>('EXPENSE');
  const [error, setError] = useState<string | undefined>();
  const create = useCreateCategory();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (create.isPending) return;
    const problem = nameError(name);
    setError(problem);
    if (problem) return;
    create.mutate(
      { name: name.trim(), type },
      {
        onSuccess: (category) => {
          setName('');
          onDone(`Category "${category.name}" added.`);
        },
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="new-category-title"
      className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h3 id="new-category-title" className="font-semibold text-slate-900">
        Add category
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <Field id="new-category-name" label="Name" error={error}>
          <input
            id="new-category-name"
            type="text"
            maxLength={NAME_MAX}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(undefined);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy('new-category-name', error)}
            className={inputClass}
          />
        </Field>
        <Field id="new-category-type" label="Type">
          <select
            id="new-category-type"
            value={type}
            onChange={(event) => setType(event.target.value as Kind)}
            className={inputClass}
          >
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
        </Field>
        <button type="submit" disabled={create.isPending} className={buttonClass}>
          {create.isPending ? 'Adding…' : 'Add category'}
        </button>
      </div>
      {create.isError && <ErrorMessage error={create.error} />}
    </form>
  );
}

function CategoryGroup({
  type,
  rows,
  onMessage,
}: {
  type: Kind;
  rows: Category[];
  onMessage: (m: string) => void;
}) {
  const title = type === 'EXPENSE' ? 'Expense categories' : 'Income categories';
  return (
    <section
      aria-label={title}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h3 className="mb-3 font-semibold text-slate-900">{title}</h3>
      {rows.length === 0 ? (
        <Empty>No {type === 'EXPENSE' ? 'expense' : 'income'} categories yet.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((category) => (
            <CategoryRow key={category.id} category={category} onMessage={onMessage} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CategoryRow({
  category,
  onMessage,
}: {
  category: Category;
  onMessage: (m: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | undefined>();
  const rename = useRenameCategory();
  const remove = useDeleteCategory();
  const inputId = `rename-${category.id}`;

  function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rename.isPending) return;
    const problem = nameError(name);
    setError(problem);
    if (problem) return;
    rename.mutate(
      { id: category.id, name: name.trim() },
      {
        onSuccess: (updated) => {
          setRenaming(false);
          onMessage(`Renamed to "${updated.name}".`);
        },
      },
    );
  }

  return (
    <li className="flex flex-col gap-2 py-2">
      {renaming ? (
        <form onSubmit={handleRename} noValidate className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <Field id={inputId} label={`New name for ${category.name}`} error={error}>
              <input
                id={inputId}
                type="text"
                maxLength={NAME_MAX}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(undefined);
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy(inputId, error)}
                className={inputClass}
              />
            </Field>
          </div>
          <button type="submit" disabled={rename.isPending} className={buttonClass}>
            {rename.isPending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => {
              setRenaming(false);
              setName(category.name);
              setError(undefined);
              rename.reset();
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-slate-800">{category.name}</span>
          <span className="flex gap-1">
            <button
              type="button"
              aria-label={`Rename ${category.name}`}
              onClick={() => {
                setRenaming(true);
                remove.reset();
              }}
              className="rounded-md px-2 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              Rename
            </button>
            <ConfirmButton
              label="Delete"
              accessibleLabel={`Delete ${category.name}`}
              pending={remove.isPending}
              onConfirm={() =>
                remove.mutate(category.id, {
                  onSuccess: () => onMessage(`Category "${category.name}" deleted.`),
                })
              }
            />
          </span>
        </div>
      )}
      {rename.isError && <ErrorMessage error={rename.error} />}
      {remove.isError && <ErrorMessage error={remove.error} />}
    </li>
  );
}

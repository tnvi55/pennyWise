import type { FormEvent } from 'react';
import { useState } from 'react';

import { useCreateTransaction, useUpdateTransaction } from '../../api/queries';
import type {
  Category,
  Kind,
  NewTransaction,
  Transaction,
  TransactionChanges,
} from '../../api/types';
import { ErrorMessage } from '../../components/StatusMessage';
import { buttonClass, Field, inputClass, secondaryButtonClass } from '../../components/fields';
import { describedBy } from '../../lib/aria';
import { isCalendarDate, today } from '../../lib/dates';
import { isMoneyInput } from '../../lib/money';

const NOTE_MAX = 250;

interface FormValues {
  type: Kind;
  amount: string;
  date: string;
  categoryId: string;
  note: string;
}

type FormErrors = Partial<Record<keyof FormValues, string>>;

function initialValues(existing?: Transaction): FormValues {
  if (existing) {
    return {
      type: existing.type,
      amount: existing.amount,
      date: existing.date,
      categoryId: existing.categoryId,
      note: existing.note ?? '',
    };
  }
  return { type: 'EXPENSE', amount: '', date: today(), categoryId: '', note: '' };
}

/** The same rules as the API, checked first for quick feedback. The server still decides. */
function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!isMoneyInput(values.amount)) {
    errors.amount = 'Enter a positive amount with at most 2 decimals, e.g. 125.50.';
  }
  if (!isCalendarDate(values.date)) errors.date = 'Enter a real date (YYYY-MM-DD).';
  if (!values.categoryId) errors.categoryId = 'Choose a category.';
  if (values.note.trim().length > NOTE_MAX)
    errors.note = `Keep the note to ${NOTE_MAX} characters or fewer.`;
  return errors;
}

interface TransactionFormProps {
  categories: Category[];
  /** When set, the form edits this transaction; otherwise it creates a new one. */
  existing?: Transaction;
  onDone: (message: string) => void;
  onCancel?: () => void;
}

export function TransactionForm({ categories, existing, onDone, onCancel }: TransactionFormProps) {
  const [values, setValues] = useState<FormValues>(() => initialValues(existing));
  const [errors, setErrors] = useState<FormErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const mutation = existing ? update : create;
  const pending = mutation.isPending;

  // Only categories of the chosen type can be picked, so a type/category mismatch can't be entered.
  const choices = categories.filter((category) => category.type === values.type);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setNotice(null);
  }

  function changeType(type: Kind) {
    setValues((current) => {
      const stillValid = categories.some((c) => c.id === current.categoryId && c.type === type);
      return { ...current, type, categoryId: stillValid ? current.categoryId : '' };
    });
    setNotice(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return; // never send the same form twice

    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const note = values.note.trim() === '' ? null : values.note.trim();
    const full: NewTransaction = {
      type: values.type,
      amount: values.amount,
      date: values.date,
      categoryId: values.categoryId,
      note,
    };

    if (!existing) {
      create.mutate(full, {
        onSuccess: () => {
          setValues(initialValues());
          onDone('Transaction added.');
        },
      });
      return;
    }

    // PATCH only what changed; the API validates the merged record.
    const changes: TransactionChanges = {};
    if (full.type !== existing.type) changes.type = full.type;
    if (full.amount !== existing.amount) changes.amount = full.amount;
    if (full.date !== existing.date) changes.date = full.date;
    if (full.categoryId !== existing.categoryId) changes.categoryId = full.categoryId;
    if (full.note !== existing.note) changes.note = full.note;
    if (Object.keys(changes).length === 0) {
      setNotice('Nothing has changed.');
      return;
    }
    update.mutate(
      { id: existing.id, changes },
      { onSuccess: () => onDone('Transaction updated.') },
    );
  }

  const title = existing ? 'Edit transaction' : 'Add transaction';
  const prefix = existing ? `edit-${existing.id}` : 'new';

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby={`${prefix}-title`}
      className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h3 id={`${prefix}-title`} className="font-semibold text-slate-900">
        {title}
      </h3>

      <fieldset className="flex gap-4">
        <legend className="mb-1 text-sm font-medium text-slate-700">Type</legend>
        {(['EXPENSE', 'INCOME'] as const).map((type) => (
          <label key={type} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${prefix}-type`}
              value={type}
              checked={values.type === type}
              onChange={() => changeType(type)}
            />
            {type === 'EXPENSE' ? 'Expense' : 'Income'}
          </label>
        ))}
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id={`${prefix}-amount`}
          label="Amount (₹)"
          error={errors.amount}
          hint="For example 125.50"
        >
          <input
            id={`${prefix}-amount`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={values.amount}
            onChange={(event) => set('amount', event.target.value.trim())}
            aria-invalid={errors.amount ? true : undefined}
            aria-describedby={describedBy(`${prefix}-amount`, errors.amount, 'hint')}
            className={inputClass}
          />
        </Field>

        <Field id={`${prefix}-date`} label="Date" error={errors.date}>
          <input
            id={`${prefix}-date`}
            type="date"
            value={values.date}
            onChange={(event) => set('date', event.target.value)}
            aria-invalid={errors.date ? true : undefined}
            aria-describedby={describedBy(`${prefix}-date`, errors.date)}
            className={inputClass}
          />
        </Field>

        <Field id={`${prefix}-category`} label="Category" error={errors.categoryId}>
          <select
            id={`${prefix}-category`}
            value={values.categoryId}
            onChange={(event) => set('categoryId', event.target.value)}
            aria-invalid={errors.categoryId ? true : undefined}
            aria-describedby={describedBy(`${prefix}-category`, errors.categoryId)}
            className={inputClass}
          >
            <option value="">Choose…</option>
            {choices.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <Field id={`${prefix}-note`} label="Note (optional)" error={errors.note}>
          <input
            id={`${prefix}-note`}
            type="text"
            maxLength={NOTE_MAX}
            value={values.note}
            onChange={(event) => set('note', event.target.value)}
            aria-invalid={errors.note ? true : undefined}
            aria-describedby={describedBy(`${prefix}-note`, errors.note)}
            className={inputClass}
          />
        </Field>
      </div>

      {mutation.isError && <ErrorMessage error={mutation.error} />}
      {notice && (
        <p role="status" className="text-sm text-slate-600">
          {notice}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? 'Saving…' : existing ? 'Save changes' : 'Add transaction'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

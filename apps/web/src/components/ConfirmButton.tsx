import { useState } from 'react';

interface ConfirmButtonProps {
  /** Visible text, e.g. "Delete". */
  label: string;
  /** Accessible name that says what will be affected, e.g. "Delete Rent". */
  accessibleLabel: string;
  onConfirm: () => void;
  pending?: boolean;
}

/**
 * A two-step destructive action: the first click asks, the second one does it.
 * Keyboard-friendly and needs no modal dialog.
 */
export function ConfirmButton({
  label,
  accessibleLabel,
  onConfirm,
  pending = false,
}: ConfirmButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        aria-label={accessibleLabel}
        onClick={() => setConfirming(true)}
        className="rounded-md px-2 py-1 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        {label}
      </button>
    );
  }

  return (
    <span className="inline-flex gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          onConfirm();
          setConfirming(false);
        }}
        className="rounded-md bg-red-600 px-2 py-1 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {pending ? 'Deleting…' : `Confirm ${label.toLowerCase()}`}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
      >
        Cancel
      </button>
    </span>
  );
}

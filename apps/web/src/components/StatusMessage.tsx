import type { ReactNode } from 'react';

import { ApiError } from '../api/client';

/** Loading text announced politely to screen readers. */
export function Loading({ label }: { label: string }) {
  return (
    <p role="status" className="py-6 text-center text-sm text-slate-500">
      {label}
    </p>
  );
}

/** Shown when a request worked but there is nothing to display. */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}

/** An error with the API's own messages and an optional Retry button. */
export function ErrorMessage({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const messages = error instanceof ApiError ? error.messages : ['Something went wrong.'];
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
    >
      <ul className="list-inside list-disc">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md border border-red-300 bg-white px-3 py-1 font-medium text-red-800 hover:bg-red-100"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/** A short success note, announced to screen readers. */
export function SuccessMessage({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">
      {children}
    </p>
  );
}

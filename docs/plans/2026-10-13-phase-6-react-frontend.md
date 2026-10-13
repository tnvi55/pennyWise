# Phase 6: React frontend (approved plan)

> Saved exactly as approved on 2026-10-13, before implementation. Implemented in `67a66bd`; results and deviations are in [progress.md](../progress.md#phase-6-react-frontend). Status statements below describe the repo at planning time.

## Context

The backend MVP is complete and on `main` (`0736789`, CI passed). Phase 6 adds the browser app from plan.md sections 7 and 8, with three views:

- **Dashboard:** month picker, income/expense/net cards, expense breakdown.
- **Transactions:** filters, table with pagination, add/edit form, delete confirmation.
- **Categories:** list, add, rename, remove.

Every MVP flow should work in the browser against the real API and the seeded database.

Branch: `feature/web-frontend`, from `main`.

## Dependency batch (needs your approval)

These versions were checked on npm today, all pinned exactly, in the new `apps/web` workspace.

| Package                                                      | Version                       | Kind    | Why                                                                                                                                                                                              |
| ------------------------------------------------------------ | ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `react`, `react-dom`                                         | 19.3.0                        | runtime | UI library                                                                                                                                                                                       |
| `@tanstack/react-query`                                      | 5.104.2                       | runtime | Server-state cache. After a create, edit or delete it invalidates and refetches the affected list and summary (plan §17). It also handles loading and error states without hand-written effects. |
| `vite`                                                       | 8.3.4                         | dev     | Dev server and build                                                                                                                                                                             |
| `@vitejs/plugin-react`                                       | 6.1.2                         | dev     | JSX and Fast Refresh for Vite                                                                                                                                                                    |
| `tailwindcss`, `@tailwindcss/vite`                           | 4.3.3                         | dev     | Styling, as plan §8 requires. No component library.                                                                                                                                              |
| `@types/react`, `@types/react-dom`                           | 19.3.0                        | dev     | Types                                                                                                                                                                                            |
| `vitest`                                                     | 5.0.4                         | dev     | Test runner that shares Vite's config. Native ESM, so no `--experimental-vm-modules` workaround is needed here.                                                                                  |
| `jsdom`                                                      | 30.1.2                        | dev     | A browser-like DOM for tests                                                                                                                                                                     |
| `@testing-library/react`, `/dom`, `/user-event`, `/jest-dom` | 16.3.3, 10.4.2, 14.6.8, 7.0.1 | dev     | Test components the way a user does: find by label or role, type, click                                                                                                                          |
| `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`   | 7.1.1, 0.5.7                  | dev     | Hook rules and Fast Refresh safety                                                                                                                                                               |

These are reused at the versions `apps/api` already pins: `typescript` 6.0.3, `eslint` 10.12.0, `typescript-eslint` 8.71.1, `@eslint/js`, `globals` and `eslint-config-prettier`.

**Not added:**

- a router: three views use a 20-line hash router (`#/transactions`), so the back button and links still work;
- a component library;
- zod: small hand-written type guards check API responses at runtime;
- MSW: tests stub `fetch` with `vi.stubGlobal`.

## Structure (`apps/web/`)

```
index.html  vite.config.ts  vitest.config.ts  tsconfig.json  eslint.config.mjs  package.json
src/
  main.tsx, App.tsx               QueryClientProvider, layout, hash-router nav
  api/
    types.ts                      Category, Transaction, Page, Summary, ApiErrorBody
    guards.ts                     runtime checks for every response shape
    client.ts                     typed fetch: base URL, JSON, ApiError(status, messages[])
    queries.ts                    useCategories / useTransactions / useSummary,
                                  mutations that invalidate the right query keys
  lib/
    money.ts                      formatInr("1234567.5") → "₹12,34,567.50" from the STRING,
                                  Indian grouping, no Number(); isMoneyInput (mirrors the API)
    dates.ts                      currentMonth(), isCalendarDate (mirrors the API)
  components/                     StatusMessage (loading/empty/error, aria-live), ConfirmButton,
                                  FieldError, MonthPicker
  features/
    dashboard/   DashboardView, SummaryCards, ExpenseBreakdown (list with simple width bars)
    transactions/ TransactionsView, TransactionFilters, TransactionTable, Pagination, TransactionForm
    categories/  CategoriesView, CategoryForm, CategoryRow (inline rename, delete with 409 message)
  test/setup.ts                   jest-dom matchers, fetch stub helpers
```

## Behaviour

- **API base URL** comes from `VITE_API_BASE_URL` (already in `.env.example`). Vite reads the root `.env` (`envDir: '../..'`); only `VITE_` variables reach the browser.
- The dev server runs on `5173`, which is exactly the API's `CORS_ORIGIN`, with `strictPort`.
- **Money:**
  - inputs are `type="text" inputMode="decimal"` and the value stays a string end to end;
  - client-side checks use the same rules as the API, for fast feedback;
  - the server stays the authority, and its 400 messages are shown next to the form;
  - display formatting works on the string, so there's no float rounding.
- **Forms:**
  - every input has a `<label>`; errors use `aria-invalid` and `aria-describedby`;
  - submit is disabled while pending, so it can't be sent twice;
  - success shows a status message; edit pre-fills the form; Cancel resets it.
- **Type and category:**
  - the category dropdown only shows categories of the selected type, so the mismatch can't be entered;
  - the API still validates it, and if it ever answers 400, that message is shown.
- **Filters** (month, type, category, page) live in view state and survive mutations. Changing a filter resets to page 1.
- **Delete:** "Delete" turns into "Confirm delete / Cancel". A 409 when deleting a used category shows the API message.
- **After a mutation:** a successful transaction mutation invalidates `['transactions']` and `['summary']`; a category mutation invalidates `['categories']` (and the transaction lists, for renamed names).
- **Every data area** has loading, empty, error-with-retry and success states.
- **Responsive:** single column on phones; cards in a row and a scrollable table on wider screens.

## Tests (Vitest + Testing Library, mocked `fetch`)

- **`lib/money`:** Indian grouping, `"0.00"`, `"-1500.50"`, large values, invalid input; input checks matching the API cases.
- **`api/client`:** success JSON; a 400 body becomes `ApiError` with its messages; a 204 has no body; a malformed response fails the guard; a network error.
- **`TransactionForm`:**
  - required and format errors shown and not submitted;
  - the category list is filtered by type;
  - the request body is sent with `amount` as a string;
  - server 400 messages are shown;
  - submit is disabled while pending, so double-clicking sends one request;
  - edit mode pre-fills the form and sends a PATCH with the changed fields.
- **`TransactionsView`:** loading → rows; empty state; error state with Retry; filter change refetches with the right query string; delete confirm flow.
- **`DashboardView`:** cards show formatted totals and the breakdown; empty month.
- **`CategoriesView`:** add, rename, and a 409 on delete shows the message.

## Repo wiring

- Root scripts: `dev:web`, plus the existing `lint`, `typecheck`, `test` and `build`, which pick up the web workspace automatically. CI needs no change for that.
- The e2e step stays API-only.
- Prettier formats `apps/web` like the rest of the repo.
- The lockfile is updated and committed.

## Docs

- README: run both apps (`dev:api` and `dev:web`); a frontend section.
- `architecture.md`: web structure and the browser → API flow.
- `progress.md`: Phase 5 marked complete (`0736789`, CI run 38415857809), and the Phase 6 section.
- ADR 0005: frontend choices (TanStack Query, Tailwind, hash routing, no router or component library).

## Verification

1. `format:check`, `lint`, `typecheck`, `test` (API and web), `test:e2e` and `build` (API and web) all pass.
2. A real run: start the API and `npm run dev:web` against the seeded dev DB. Check:
   - `curl` gets the served page;
   - `vite build` output loads;
   - a CORS preflight from `http://localhost:5173` succeeds.
3. **Your manual browser check:** the steps will be in progress.md, covering the dashboard for 2026-10, filtering, adding/editing/deleting a transaction, a category rename, and deleting a used category (409 message). I can't see a browser myself, so this step is yours.
4. CI on push to `main`, with your authorization.

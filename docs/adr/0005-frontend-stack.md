# ADR 0005: Frontend stack: React, Vite, TanStack Query, Tailwind, no router

- Status: Accepted
- Date: 2026-10-13

## Context

Phase 6 adds the browser app. It has three views (dashboard, transactions, categories), with forms that change server data. After each change, the lists and the monthly summary must refresh, and the filters must be kept (plan.md section 17). The project prefers few, well-understood dependencies, and plan.md asks for Tailwind and no heavy component library.

## Decision

- **React 19 + Vite 8** in `apps/web`, strict TypeScript, ESLint with type-aware and React Hooks rules.
- **TanStack Query** for server state.
  - Queries are cached under keys (`['transactions', filters]`, `['summary', month]`, `['categories']`).
  - A successful mutation **invalidates** the affected keys, so every visible list and summary refetches.
  - It also provides loading, error and retry states without hand-written `useEffect` fetching.
- **A typed `fetch` client** (`src/api/client.ts`) plus **hand-written runtime guards** (`src/api/guards.ts`). Every response is checked before the UI uses it; for example, an amount must be a two-decimal string. Errors become `ApiError(status, messages)`, carrying the API's own messages.
- **Money stays a string** in the browser too.
  - Inputs are `type="text" inputMode="decimal"`.
  - `formatInr` adds Indian digit grouping (`₹12,34,567.50`) by string manipulation, not `Intl.NumberFormat`, which would first turn the string into a float.
- **Tailwind CSS 4** through its Vite plugin, used directly in components.
- **A 20-line hash router** (`#/dashboard`, `#/transactions`, `#/categories`) instead of a routing library. Links, Back and Forward work, and the static build needs no server rewrite rules.
- **Tests:** Vitest + Testing Library + jsdom, with `fetch` stubbed by a small fake API helper (`src/test/helpers.tsx`).
- **Config:** Vite reads `VITE_*` variables from the root `.env` (`envDir: '../..'`). The dev server uses port 5173 with `strictPort`, matching the API's `CORS_ORIGIN`.

## Alternatives considered

| Option                                   | Why not (for now)                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Plain `useEffect` + `useState` fetching  | Re-implements caching, refetch after mutations, race handling and loading states by hand.       |
| React Router                             | More than three static views need; the hash router is small and fully visible in `App.tsx`.     |
| zod (or similar) for response validation | Adds a dependency for five shapes; type guards are short and keep the checks explicit.          |
| MSW for API mocking                      | A `fetch` stub is enough for component tests; the real API is covered by the backend e2e tests. |
| A component library (MUI, Chakra)        | plan.md asks for a clean, minimal look without a heavy library.                                 |
| `Intl.NumberFormat` for INR              | It needs a JS number, which could round large or fractional values.                             |

## Consequences

- New server data needs a query key, and new mutations must say which keys they invalidate (`src/api/queries.ts`).
- If the app grows many nested pages, switching to a router library is a contained change in `App.tsx`.
- The production bundle is about 150 kB gzipped. Code-splitting can come later if needed.

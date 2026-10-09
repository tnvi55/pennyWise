# Requirements

Source: [plan.md](../plan.md) sections 2 and 14. This file summarizes them and is updated when behavior changes.

## MVP

- Record **income** and **expense** transactions: amount, date, category, optional note (max 250 chars).
- List, edit and delete transactions.
- Filter transactions by month (`YYYY-MM`), type and category; newest first; paginated.
- Manage categories: create, list, rename, delete when unused.
- Monthly summary: income, expenses, net balance and expense totals per category.
- Single user, local, unauthenticated. Currency is INR only.

## Key rules

- Amounts are strictly positive decimal strings such as `"125.50"`, stored as `Decimal(12,2)`. Type decides whether an amount adds to or subtracts from the balance.
- Dates are calendar dates in `YYYY-MM-DD` format, stored as PostgreSQL `DATE`, with no timezone drift.
- A transaction's category must exist and have the same type as the transaction.
- Category type cannot change after creation; `(name, type)` is unique.
- A category that is referenced by transactions cannot be deleted (HTTP 409).

## Out of scope for MVP

Authentication, bank integration, recurring transactions, multi-currency, budgets/alerts, charts, CSV export and deployment. Public hosting would need a separate security phase.

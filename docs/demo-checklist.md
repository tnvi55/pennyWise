# Demonstration checklist

Use this list to show, or check, that PennyWise meets its completion criteria (plan.md section 13). Each step says what to do and what you should see. It takes about 15 minutes.

## A. Clean clone to running app

1. Clone the repo and run `cp .env.example .env`, then `npm ci`. **Expect:** no errors; `apps/api/src/generated/prisma` exists.
2. Start Docker Desktop, then run `docker compose up -d` and `docker compose ps`. **Expect:** `pennywise-postgres-1 … (healthy)`, port `127.0.0.1:5432->5432/tcp`.
3. Run `npm run db:migrate`. **Expect:** migration `…_init` applied, or "Already in sync".
4. Run `npm run db:seed` twice. **Expect:** both runs end with "9 categories and 15 transactions" (no duplicates).
5. Run `npm run dev:api`. Open http://localhost:3000/api/docs. **Expect:** Swagger lists health, categories, transactions and summary.
6. Run `npm run dev:web`. Open http://localhost:5173. **Expect:** the PennyWise dashboard.

## B. Monthly summary

7. On **Dashboard**, choose **October 2026**. **Expect:**
   - income ₹86,500.00, expenses ₹23,450.29, net ₹63,049.71;
   - breakdown: Rent ₹22,000.00, Other ₹999.99, Transport ₹450.00, Groceries ₹0.30.
8. Choose **September 2026**. **Expect:** income ₹97,500.00, expenses ₹32,105.55, net ₹65,394.45.
9. Choose a month with no data (e.g. January 2025). **Expect:** ₹0.00 everywhere and "No expenses in January 2025."

## C. Transactions

10. Open **Transactions** and set the month to **October 2026**. **Expect:** 7 rows, newest first; "Page 1 of 1 · 7 transactions".
11. Filter **Type: Income**. **Expect:** Salary and Other (Cashback). Then filter a **Category**. **Expect:** only that category's rows.
12. Add an expense: amount `12.345`. **Expect:** a field error, and nothing saved. Change it to `120.50`, choose a date in October 2026 and an expense category. **Expect:** "Transaction added." The row appears, and the dashboard expenses rise by ₹120.50.
13. In the form, switch **Type** to Income. **Expect:** the category list shows only income categories.
14. Edit the new row and change the amount to `99.90`. **Expect:** "Transaction updated." and the new amount in the table.
15. Delete it: **Delete**, then **Confirm delete**. **Expect:** "Transaction deleted." The dashboard returns to the October totals from step 7.

## D. Categories

16. Open **Categories**, add **Books** (Expense), then rename it to **Reading**. **Expect:** a success message each time.
17. Add **Rent** (Expense) again. **Expect:** `Category "Rent" (EXPENSE) already exists`.
18. Delete **Rent**. **Expect:** "Category is used by one or more transactions and cannot be deleted". Then delete **Reading**. **Expect:** it disappears.

## E. Quality

19. Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e` and `npm run build`. **Expect:** every command exits 0. (`test:e2e` needs `TEST_DATABASE_URL` and Docker.)
20. Open the latest **GitHub Actions** run for `main`. **Expect:** every step green.
21. Optional: connect pgAdmin or Beekeeper Studio (see README) and run a query from [sql-basics.md](sql-basics.md).

## F. Explain it

22. Follow one request through the code and explain each step: React form → `api/client.ts` → `TransactionsController` → `TransactionsService` (merged validation) → `PrismaService` → PostgreSQL constraints. Use [architecture.md](architecture.md).
23. Explain three decisions using the ADRs:
    - why money is a string ([ADR 0004](adr/0004-money-and-dates-at-the-api-boundary.md));
    - why the database decides conflicts ([architecture.md](architecture.md#request-flow-categories-implemented-phase-3));
    - why TanStack Query ([ADR 0005](adr/0005-frontend-stack.md)).

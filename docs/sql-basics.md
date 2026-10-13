# SQL basics with PennyWise

A short tour of the SQL behind PennyWise. Run these queries in Beekeeper Studio or pgAdmin, connected as described in the [README](../README.md#connect-a-gui-beekeeper-studio-or-pgadmin), after `npm run db:migrate` and `npm run db:seed`. The results shown come from the seed data.

All the queries here only read data, except the constraint experiments in section 5, which are wrapped in `BEGIN … ROLLBACK` so they change nothing.

## 1. Tables: `CREATE TABLE` (from our migration)

Prisma turned `schema.prisma` into this SQL in [`prisma/migrations/…_init/migration.sql`](../apps/api/prisma/migrations):

```sql
CREATE TYPE "CategoryType" AS ENUM ('INCOME', 'EXPENSE');

CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "type" "CategoryType" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "type" "CategoryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" DATE NOT NULL,
    "note" VARCHAR(250),
    "category_id" UUID NOT NULL,
    ...
);
```

- **A table** is like a spreadsheet with fixed, typed columns. Each row is one record.
- **Types matter:**
  - `DECIMAL(12,2)` stores money exactly: up to 10 digits before the point and 2 after. There are no floating-point errors.
  - `DATE` is a calendar day only: no time and no timezone, so `2026-09-30` can never shift to the 29th.
  - `VARCHAR(80)` caps the text length.
- **`NOT NULL`** means the column is required. `note` has no `NOT NULL`, so it's optional.
- **A primary key** (`id`) identifies each row uniquely. We use UUIDs.

## 2. Reading rows: `SELECT`

```sql
SELECT date, type, amount, note
FROM transactions
WHERE date >= DATE '2026-10-01' AND date < DATE '2026-11-01'
ORDER BY date DESC, created_at DESC, id DESC;
```

- **`WHERE`** filters rows. A month is `[first day, first day of next month)`. The upper bound is exclusive (`<`), so the last day of the month is included whatever its number.
- **`ORDER BY`** sorts. The extra `created_at` and `id` columns make the order _stable_: two transactions on the same date always come out in the same order. Pagination needs this.

## 3. Combining tables: `JOIN`

Transactions store only `category_id`. A join looks up the matching category row:

```sql
SELECT t.date, c.name AS category, t.type, t.amount, t.note
FROM transactions t
JOIN categories c ON c.id = t.category_id
WHERE t.date >= DATE '2026-10-01' AND t.date < DATE '2026-11-01'
ORDER BY t.date DESC, t.created_at DESC, t.id DESC
LIMIT 5;
```

```
    date    | category  |  type   | amount  |        note
------------+-----------+---------+---------+---------------------
 2026-10-10 | Other     | EXPENSE |  999.99 | Gift
 2026-10-09 | Other     | INCOME  | 1500.00 | Cashback
 2026-10-06 | Transport | EXPENSE |  450.00 |
 2026-10-03 | Groceries | EXPENSE |    0.20 | Decimal check: 0.20
 2026-10-03 | Groceries | EXPENSE |    0.10 | Decimal check: 0.10
```

There are two categories named "Other", one per type. That's allowed because uniqueness is on the pair `(name, type)`.

## 4. Totals: aggregates and `GROUP BY`

```sql
-- Income vs expenses for September 2026
SELECT type, sum(amount) AS total
FROM transactions
WHERE date >= DATE '2026-09-01' AND date < DATE '2026-10-01'
GROUP BY type;
```

```
  type   |  total
---------+----------
 INCOME  | 97500.00
 EXPENSE | 32105.55
```

```sql
-- Expenses by category for September 2026
SELECT c.name, sum(t.amount) AS spent
FROM transactions t
JOIN categories c ON c.id = t.category_id
WHERE t.type = 'EXPENSE' AND t.date >= DATE '2026-09-01' AND t.date < DATE '2026-10-01'
GROUP BY c.name
ORDER BY spent DESC;
```

```
    name    |  spent
------------+----------
 Rent       | 22000.00
 Groceries  |  6325.95
 Utilities  |  1899.50
 Eating out |  1240.10
 Transport  |   640.00
```

**`GROUP BY`** makes one output row per group, and **`sum()`** adds up the rows in each group. PostgreSQL adds `DECIMAL` values exactly: the two "Decimal check" rows sum to exactly `0.30`, where JavaScript's `0.1 + 0.2` gives `0.30000000000000004`. That's why the Summary API (Phase 5) lets the database do the arithmetic.

## 5. Constraints: rules the database enforces

| Constraint                      | Rule                               | Try it (inside `BEGIN; … ROLLBACK;`)                      |
| ------------------------------- | ---------------------------------- | --------------------------------------------------------- |
| `transactions_amount_positive`  | `CHECK (amount > 0)`               | insert an amount of `0` → "violates check constraint"     |
| `categories_name_not_blank`     | `CHECK (btrim(name) <> '')`        | insert a name of `'   '` → "violates check constraint"    |
| `categories_name_type_key`      | `UNIQUE (name, type)`              | insert `('Groceries', 'EXPENSE')` again → "duplicate key" |
| `transactions_category_id_fkey` | `FOREIGN KEY … ON DELETE RESTRICT` | delete category Rent → "violates RESTRICT setting"        |

```sql
BEGIN;
DELETE FROM categories WHERE name = 'Rent' AND type = 'EXPENSE';
-- ERROR: update or delete on table "categories" violates RESTRICT setting of
--        foreign key constraint "transactions_category_id_fkey" on table "transactions"
ROLLBACK;
```

- **Foreign key:** every `transactions.category_id` must exist in `categories`. `RESTRICT` blocks deleting a category that is still in use. The API will turn that into HTTP 409 (Phase 3).
- **The database is the last line of defence.** The API validates input first and gives friendly errors, but the constraints still hold even if a bug or a manual SQL edit slips through.
- **Watch out:** `DECIMAL(12,2)` silently _rounds_ extra decimals (`1.005` is stored as `1.01`) rather than rejecting them. So the API must reject amounts with more than 2 decimal places itself (Phase 4).

## 6. Indexes and `EXPLAIN`

An **index** is a sorted lookup structure, like a book's index, that lets PostgreSQL find rows without reading the whole table. We have two besides the primary keys and the unique pair:

- `transactions_category_id_idx` on `(category_id)`: for "transactions in this category" and the check PostgreSQL runs before deleting a category.
- `transactions_date_created_at_id_idx` on `(date DESC, created_at DESC, id DESC)`: for month filters, already in list order.

`EXPLAIN` shows the _query plan_, i.e. how PostgreSQL intends to run a query:

```sql
EXPLAIN SELECT * FROM transactions
WHERE date >= DATE '2026-10-01' AND date < DATE '2026-11-01'
ORDER BY date DESC, created_at DESC, id DESC;
```

```
Index Scan using transactions_date_created_at_id_idx on transactions
  Index Cond: ((date >= '2026-10-01'::date) AND (date < '2026-11-01'::date))
```

- The index finds the October rows, **and** because it is already sorted the plan has no separate `Sort` step.
- With very few rows, PostgreSQL may choose a `Seq Scan` (read everything) instead. For a tiny table that's actually cheaper, so don't worry about it.
- Indexes aren't free: every insert and update must also update them. That's why we only add ones that a real query needs.

## 7. Migration history

```sql
SELECT migration_name, finished_at FROM _prisma_migrations;
```

- Prisma records every applied migration in `_prisma_migrations`.
- `npm run db:migrate` (`prisma migrate dev`) compares that table with the files in `prisma/migrations`, then applies what's missing. After a change to `schema.prisma`, it also writes a new migration.
- `npm run db:deploy` (`prisma migrate deploy`) only applies existing files. It's used for CI and shared databases.
- Migration files are committed to Git, so every machine builds the same schema step by step. **Never edit a migration that has already been applied and committed;** add a new one instead.

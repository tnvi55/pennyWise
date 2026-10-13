# API design

> Status: **contract**. Implemented: every endpoint. `GET /health` (Phase 1), categories (Phase 3), transactions (Phase 4) and summary (Phase 5). JSON request/response examples are added here before each feature phase (3–5) implements them. Source: [plan.md](../plan.md) sections 6 and 14.

Base path: `/api/v1`. OpenAPI UI: `/api/docs`; OpenAPI JSON: `/api/docs-json` (Phase 1, implemented).

`GET /api/v1/health` → `200 {"status":"ok","timestamp":"2026-10-12T09:30:00.000Z"}`. `timestamp` is the server time as an ISO 8601 UTC string.

## Endpoints

| Method | Path                | Success | Purpose                                                       |
| ------ | ------------------- | ------- | ------------------------------------------------------------- |
| GET    | `/health`           | 200     | liveness (Phase 1)                                            |
| GET    | `/categories`       | 200     | list; optional `type`                                         |
| POST   | `/categories`       | 201     | create                                                        |
| PATCH  | `/categories/:id`   | 200     | rename (type is immutable)                                    |
| DELETE | `/categories/:id`   | 204     | delete if unused, else 409                                    |
| GET    | `/transactions`     | 200     | list; `month`, `type`, `categoryId`, `page`, `pageSize`       |
| POST   | `/transactions`     | 201     | create                                                        |
| GET    | `/transactions/:id` | 200     | get one                                                       |
| PATCH  | `/transactions/:id` | 200     | partial update; the merged record is validated                |
| DELETE | `/transactions/:id` | 204     | delete                                                        |
| GET    | `/summary`          | 200     | `month` required; income, expenses, net, expenses-by-category |

## Shared rules

- **Money:** the JSON value must be a string such as `"125.50"`.
  - It must be greater than 0 and at most `9999999999.99`, with at most 2 decimal places.
  - JSON numbers, signs and exponent notation are rejected.
  - Every output amount uses exactly 2 decimals, including `"0.00"`. Net balance may be negative.
- **Dates:** real calendar dates in `YYYY-MM-DD`; datetime strings and `null` are rejected.
- **Month:** `YYYY-MM`. A month covers the range `[first day, first day of next month)`.
- **Pagination:** `page` defaults to 1. `pageSize` defaults to 20, with a maximum of 100.
  - Response shape: `{ data, meta: { page, pageSize, total, totalPages } }`.
  - `totalPages` is 0 when there are no results.
- **Sorting:** `date` desc, then `createdAt` desc, then `id` desc.
- **Summary shape:** `{ month, currency: "INR", income, expenses, net, expensesByCategory: [{ categoryId, categoryName, amount }] }`.
- **Unknown fields** in a request body are rejected. A PATCH with an empty body is rejected.
- **Errors:** `{ statusCode, error, message }`, where `message` is a string or a string array.
  - **400:** malformed UUID or month, invalid field, unknown category in a transaction, category/type mismatch.
  - **404:** the target resource is missing, or the route does not exist under `/api/v1`.
  - **409:** duplicate category, or deleting a category that is still referenced.
  - **500:** `{ "statusCode": 500, "error": "Internal Server Error", "message": "Internal server error" }` for anything unexpected; details are logged on the server only.
  - Raw database errors are never returned.

## Categories (implemented, Phase 3)

A category:

```json
{
  "id": "f28a07e4-d5ee-4071-aa0b-eec10db1605c",
  "name": "Groceries",
  "type": "EXPENSE",
  "createdAt": "2026-10-13T12:14:16.173Z",
  "updatedAt": "2026-10-13T12:14:16.173Z"
}
```

- `type` is `INCOME` or `EXPENSE` and can never change.
- `name` is trimmed, then must be 1–80 characters. `(name, type)` is unique and case-sensitive, so `Other` can exist once as INCOME and once as EXPENSE, and `Rent` and `rent` are different names.

### `GET /api/v1/categories`

Optional query: `type=INCOME|EXPENSE`. Any other query parameter → 400.

`200` returns a plain array (no pagination; categories are few), sorted by `name`, then `type` (INCOME before EXPENSE), then `id`:

```json
[
  { "id": "…", "name": "Freelance", "type": "INCOME", "createdAt": "…", "updatedAt": "…" },
  { "id": "…", "name": "Other", "type": "INCOME", "createdAt": "…", "updatedAt": "…" },
  { "id": "…", "name": "Other", "type": "EXPENSE", "createdAt": "…", "updatedAt": "…" }
]
```

### `POST /api/v1/categories`

```json
{ "name": "  Groceries ", "type": "EXPENSE" }
```

`201` returns the created category, with `"name": "Groceries"`.

| Case                                                         | Status | `message`                                                                                                                   |
| ------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| name missing, blank, `null`, a number, or over 80 characters | 400    | e.g. `["name should not be empty"]`, `["name must be a string"]`, `["name must be shorter than or equal to 80 characters"]` |
| type missing or not INCOME/EXPENSE                           | 400    | `["type must be one of the following values: INCOME, EXPENSE"]`                                                             |
| unknown field, e.g. `colour`                                 | 400    | `["property colour should not exist"]`                                                                                      |
| same name and type already exist                             | 409    | `Category "Groceries" (EXPENSE) already exists`                                                                             |

### `PATCH /api/v1/categories/:id`

Renames only. The body must be exactly `{ "name": "…" }`, using the same name rules.

`200` returns the updated category, with a newer `updatedAt`.

| Case                                                    | Status | `message`                                                   |
| ------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| `:id` is not a UUID                                     | 400    | `Validation failed (uuid is expected)`                      |
| empty body `{}` or invalid name                         | 400    | e.g. `["name should not be empty", …]`                      |
| `type` in the body (type is immutable)                  | 400    | `["property type should not exist"]`                        |
| no category with that id                                | 404    | `Category <id> not found`                                   |
| another category of the same type already has that name | 409    | `Another category of the same type is already named "Rent"` |

### `DELETE /api/v1/categories/:id`

`204` with no body.

| Case                                | Status | `message`                                                            |
| ----------------------------------- | ------ | -------------------------------------------------------------------- |
| `:id` is not a UUID                 | 400    | `Validation failed (uuid is expected)`                               |
| no category with that id            | 404    | `Category <id> not found`                                            |
| transactions still use the category | 409    | `Category is used by one or more transactions and cannot be deleted` |

Example error body:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Category is used by one or more transactions and cannot be deleted"
}
```

## Transactions (implemented, Phase 4)

A transaction:

```json
{
  "id": "79e9f7ed-34ba-43f1-8fdf-a9adfb2054af",
  "type": "EXPENSE",
  "amount": "42.50",
  "date": "2026-10-12",
  "note": "Weekly groceries",
  "categoryId": "aa02f065-2218-4f3d-9929-bd5e14fc8bc0",
  "category": { "id": "aa02f065-2218-4f3d-9929-bd5e14fc8bc0", "name": "Groceries" },
  "createdAt": "2026-10-13T14:25:16.917Z",
  "updatedAt": "2026-10-13T14:25:16.917Z"
}
```

### Field rules

| Field        | Rule                                                                                                    | Accepted                                      | Rejected (400)                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `type`       | `INCOME` or `EXPENSE`                                                                                   | `"EXPENSE"`                                   | `"TRANSFER"`, `"expense"`                                                                                                       |
| `amount`     | JSON **string**, > 0, at most 2 decimals and `9999999999.99`; no sign, exponent, spaces or leading zero | `"0.01"`, `"5"`, `"125.5"`, `"9999999999.99"` | `125.5` (number), `"0"`, `"0.00"`, `"-5"`, `"+5"`, `"1e3"`, `"1.005"`, `"01.5"`, `" 5"`, `"10000000000.00"`                     |
| `date`       | real calendar day, `YYYY-MM-DD`                                                                         | `"2026-10-31"`, `"2028-02-29"`                | `"2026-02-29"`, `"2026-04-31"`, `"2026-10-03T10:00:00Z"`, `"2026-1-3"`, `null`                                                  |
| `note`       | optional, at most 250 characters, trimmed; empty → `null`                                               | `"Gift"`, `null`, omitted                     | 251 characters, a number                                                                                                        |
| `categoryId` | UUID of an **existing** category **of the same type**                                                   |                                               | malformed UUID; unknown → `Category <id> does not exist`; mismatch → `Category "Rent" is EXPENSE but the transaction is INCOME` |

- Output `amount` always has exactly 2 decimals (`"5"` is returned as `"5.00"`).
- Output `date` is exactly the day that was sent; it is stored as a PostgreSQL `DATE`, with no time or timezone.

### `GET /api/v1/transactions`

| Query        | Default | Rule                                                               |
| ------------ | ------- | ------------------------------------------------------------------ |
| `month`      | none    | `YYYY-MM`; the whole month, `[first day, first day of next month)` |
| `type`       | none    | `INCOME` or `EXPENSE`                                              |
| `categoryId` | none    | UUID; an unknown id simply matches nothing                         |
| `page`       | 1       | integer ≥ 1                                                        |
| `pageSize`   | 20      | integer from 1 to 100                                              |

Any other query parameter → 400. Sorted by `date` desc, then `createdAt` desc, then `id` desc.

`GET /api/v1/transactions?month=2026-10&pageSize=2` → `200`:

```json
{
  "data": [
    {
      "id": "…",
      "type": "EXPENSE",
      "amount": "999.99",
      "date": "2026-10-10",
      "note": "Gift",
      "…": "…"
    },
    {
      "id": "…",
      "type": "INCOME",
      "amount": "1500.00",
      "date": "2026-10-09",
      "note": "Cashback",
      "…": "…"
    }
  ],
  "meta": { "page": 1, "pageSize": 2, "total": 7, "totalPages": 4 }
}
```

With no matches: `{ "data": [], "meta": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 } }`. A page past the end returns `data: []` with the real `total` and `totalPages`.

### `POST /api/v1/transactions`

```json
{
  "type": "EXPENSE",
  "amount": "42.50",
  "date": "2026-10-12",
  "note": "Weekly groceries",
  "categoryId": "…"
}
```

`201` returns the created transaction.

### `GET /api/v1/transactions/:id`

`200` returns the transaction. Malformed id → 400; unknown id → 404 `Transaction <id> not found`.

### `PATCH /api/v1/transactions/:id`

Send any subset of `type`, `amount`, `date`, `note` and `categoryId`. `200` returns the updated transaction.

- **The merged record is validated:** the existing values plus your changes must still have a category of the same type.
  - `{ "type": "INCOME" }` on an expense in "Groceries" → 400 `Category "Groceries" is EXPENSE but the transaction is INCOME`.
  - `{ "type": "INCOME", "categoryId": "<Salary>" }` → 200.
- `{}` → 400 `Request body must contain at least one field`.
- `null` for `type`, `amount`, `date` or `categoryId` → 400. `"note": null` clears the note.
- Unknown fields (including `id`) → 400. An unknown id → 404.

### `DELETE /api/v1/transactions/:id`

`204` with no body. Malformed id → 400; unknown id → 404.

## Summary (implemented, Phase 5)

### `GET /api/v1/summary?month=YYYY-MM`

`month` is required. Any other query parameter → 400.

`GET /api/v1/summary?month=2026-10` (with the seed data) → `200`:

```json
{
  "month": "2026-10",
  "currency": "INR",
  "income": "86500.00",
  "expenses": "23450.29",
  "net": "63049.71",
  "expensesByCategory": [
    { "categoryId": "…", "categoryName": "Rent", "amount": "22000.00" },
    { "categoryId": "…", "categoryName": "Other", "amount": "999.99" },
    { "categoryId": "…", "categoryName": "Transport", "amount": "450.00" },
    { "categoryId": "…", "categoryName": "Groceries", "amount": "0.30" }
  ]
}
```

- **Totals:** every amount is a fixed two-decimal string. A month with no transactions → `"0.00"`, `"0.00"`, `"0.00"` and `[]`.
- **`net`** = income − expenses, and may be negative (`"-1500.50"`).
- **Coverage:** every transaction with `date` in `[first day, first day of next month)` counts, independent of the list's pagination.
- **`expensesByCategory`:** only categories with **expense** transactions that month. Income categories and unused categories are absent. Sorted by amount desc, then name, then id.
- **Errors:** missing `month`, `2026-13`, `2026-10-01` or `2026-1` → 400 `["month must be a month in YYYY-MM format, e.g. \"2026-10\""]`.

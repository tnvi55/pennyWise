# API design

> Status: **contract**. Implemented: `GET /health` (Phase 1) and the four category endpoints (Phase 3). JSON request/response examples are added here before each feature phase (3–5) implements them. Source: [plan.md](../plan.md) sections 6 and 14.

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

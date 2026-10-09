# API design

> Status: **contract only**. No endpoint is implemented yet. JSON request/response examples are added here before each feature phase (3–5) implements them. Source: [plan.md](../plan.md) sections 6 and 14.

Base path: `/api/v1`. OpenAPI UI: `/api/docs` (Phase 1).

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
  - **404:** the target resource is missing.
  - **409:** duplicate category, or deleting a category that is still referenced.
  - Raw database errors are never returned.

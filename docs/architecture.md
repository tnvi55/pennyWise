# Architecture

> Status: repository tooling (Phase 0), the API skeleton (Phase 1), the database layer (Phase 2), the Categories API (Phase 3) and the Transactions API (Phase 4) are implemented. Sections are marked as they are implemented.

## Repository layout

```
.
├── apps/
│   ├── api/          # NestJS server (Phase 1, implemented)
│   └── web/          # React + Vite client (Phase 6, planned)
├── docs/             # requirements, architecture, API design, progress, ADRs
├── scripts/hooks/    # Claude Code hook scripts + their tests (Phase 0, implemented)
├── .claude/          # shared Claude Code settings (hooks, deny rules)
├── compose.yaml      # local PostgreSQL (Phase 2)
├── .github/workflows # CI
└── package.json      # npm workspaces root ("apps/*")
```

npm workspaces let the root `package-lock.json` pin dependencies for both apps, and root scripts can run checks across them. See [ADR 0001](adr/0001-monorepo-and-architecture.md).

## API skeleton (implemented, Phase 1)

```
apps/api/src/
├── main.ts                  # bootstrap: create app, configureApp(), listen on 127.0.0.1
├── app.setup.ts             # /api/v1 prefix, ValidationPipe, CORS, Swagger (shared with e2e tests)
├── app.module.ts            # root module: ConfigModule (validated env) + feature modules
├── config/env.validation.ts # NODE_ENV, PORT, CORS_ORIGIN, DATABASE_URL checked once at startup
├── common/dto/              # ErrorResponseDto, the documented error shape
├── common/filters/          # UnhandledExceptionFilter: generic 500 in the same shape (Phase 3)
├── common/validation/       # money, calendar-date, month validators (Phase 4)
├── categories/              # CategoriesModule → Controller → Service, DTOs (Phase 3)
├── transactions/            # TransactionsModule → Controller → Service, DTOs (Phase 4)
├── prisma/                  # PrismaModule (global) + PrismaService (Phase 2)
├── generated/prisma/        # typed client from `prisma generate` (gitignored)
└── health/                  # HealthModule → HealthController → HealthService
```

- **Module:** groups a feature's controller and providers. `AppModule` imports each feature module.
- **Controller:** maps an HTTP route to a method. `HealthController` handles `GET /api/v1/health`.
- **Provider/service:** a class Nest creates once and injects wherever it is declared in a constructor. This is dependency injection (DI).
- **Startup order:** `ConfigModule` validates the environment before any module starts, so a bad `.env` fails fast instead of failing on the first request.
- **e2e tests** call the same `configureApp()` as `main.ts`, so they test the real prefix, pipes, CORS and Swagger setup.
- **404s:** unknown routes under `/api/v1` return the JSON error shape. Paths outside the prefix get Express's default HTML 404, because Nest registers no handler there.

## Request flow: categories (implemented, Phase 3)

```
PATCH /api/v1/categories/3f2b…   { "name": "  Food " }
  → Express + Nest router        global prefix /api/v1 → CategoriesController.rename
  → ParseUUIDPipe                ":id" must be a UUID            → else 400
  → ValidationPipe               body → UpdateCategoryDto: trim name, 1–80 chars,
                                 no unknown fields (so "type" is refused)  → else 400
  → CategoriesController         HTTP only: passes id + DTO to the service
  → CategoriesService            prisma.category.update(...), then maps Prisma errors:
                                   P2025 record not found      → 404
                                   P2002 unique (name, type)   → 409
                                   P2003 FK RESTRICT on delete → 409
                                   anything else               → re-thrown
  → PrismaService → PostgreSQL   parameterized UPDATE; constraints decide
  ← toCategoryResponse()         { id, name, type, createdAt, updatedAt } (ISO strings)
  ← UnhandledExceptionFilter     only for unexpected errors: generic 500, details logged
```

- **The database decides conflicts.** The service doesn't first check "does this name exist?" and then insert. Two requests could pass that check at the same moment. It writes straight away and turns the constraint error into 409, so the result is correct even under concurrency.
- **Errors keep one shape.** Nest's built-in `HttpException`s already produce `{ statusCode, error, message }`. The global filter gives unexpected failures the same shape without exposing SQL or stack traces.
- **Tests:**
  - Service unit tests mock `PrismaService` and check the error mapping.
  - e2e tests send real HTTP requests through `configureApp()` to a real PostgreSQL database (`pennywise_test`), guarded by `test/test-database.ts`.

## Request flow: transactions (implemented, Phase 4)

```
GET /api/v1/transactions?month=2026-10&page=2
  → ValidationPipe               query → ListTransactionsQueryDto: @IsMonth, page/pageSize
                                 converted to numbers and range-checked           → else 400
  → TransactionsController       HTTP only
  → TransactionsService.list     where = { date: monthRange('2026-10') = [10-01, 11-01) }
                                 $transaction([findMany(order, skip, take), count])
  ← { data: [...], meta: { page, pageSize, total, totalPages } }

PATCH /api/v1/transactions/:id   { "type": "INCOME" }
  → ParseUUIDPipe + ValidationPipe   fields optional, but null rejected for required ones
  → TransactionsService.update   1. empty body?                       → 400
                                 2. load existing row                 → 404 if missing
                                 3. merged = existing + changes
                                 4. category(merged.categoryId) exists and
                                    has merged.type?                  → else 400
                                 5. update only the sent fields
  ← toTransactionResponse        amount: Decimal.toFixed(2), date: 'YYYY-MM-DD'
```

- **Shared validators** (`src/common/validation/`): `money.ts`, `calendar-date.ts` and `month.ts` are pure functions plus class-validator decorators. They have their own boundary-case unit tests and will be reused by the Summary API.
- **Money never touches a JS number.** The amount arrives as a string, Prisma stores it in `DECIMAL(12,2)`, and it comes back as a `Decimal` that is formatted with `toFixed(2)`. See [ADR 0004](adr/0004-money-and-dates-at-the-api-boundary.md).
- **Dates never touch a timezone.** `'2026-10-31'` becomes `2026-10-31T00:00:00Z`, Prisma writes it to a `DATE` column as that day, and `toISOString().slice(0, 10)` gives the same string back.
- **Why validate the merged record?** Checking only the sent fields would let `{ "type": "INCOME" }` turn an expense in "Groceries" into an income in an expense category. The rule is about the whole row, so the service checks the whole row.

## Layers

Each layer has one job:

- **Controller:** handles HTTP.
- **DTO:** validates input.
- **Service:** enforces business rules.
- **Prisma:** talks to the database.

There is no generic repository layer or CQRS.

## Database layer (implemented, Phase 2)

```
apps/api/
├── prisma.config.ts          # Prisma CLI config: schema, migrations, seed, DATABASE_URL
└── prisma/
    ├── schema.prisma         # models → SQL tables, and the typed client
    ├── migrations/           # versioned SQL, committed (+ hand-added CHECK constraints)
    └── seed.ts               # synthetic, repeatable development data
```

- **Tables:** `categories` and `transactions`, with snake_case columns. The details and the SQL are in [sql-basics.md](sql-basics.md). The decisions are in [ADR 0003](adr/0003-prisma-7-and-postgres-18.md).
- **PrismaService** extends the generated `PrismaClient` and connects through the `pg` driver (`PrismaPg` adapter) using the validated `DATABASE_URL`.
  - It is global, so feature services just declare `constructor(private prisma: PrismaService)`.
  - The connection opens on the first query, so the API starts even while PostgreSQL is down.
- **Prisma queries are parameterized:** values travel separately from the SQL text, so input can't change the query (no SQL injection).
- **Values crossing the boundary:**
  - `DATE` comes back as a JS `Date` at UTC midnight; `toISOString().slice(0, 10)` gives the exact calendar day.
  - `DECIMAL` comes back as a `Decimal` object, not a JS number.

## Local runtime (implemented)

### Docker words in one line each

- **Image:** a read-only template, here the official `postgres:18.6`, downloaded once.
- **Container:** a running instance of an image (`pennywise-postgres-1`). It can be stopped, removed and recreated.
- **Volume:** storage that lives outside the container (`pennywise_pgdata`). Removing or recreating the container keeps the data; only deleting the volume itself (for example `docker compose down -v`) removes it.
- **Compose:** `compose.yaml` describes the services, ports, volumes and health check, so one `docker compose up -d` creates them all the same way on every machine.

### Who connects where

```
 Your laptop (host)                                Docker
 ┌────────────────────────────┐                    ┌─────────────────────────────────┐
 │ NestJS API (PrismaService) │── 127.0.0.1:5432 ─▶│ container pennywise-postgres-1  │
 │ Prisma CLI (migrate, seed) │── 127.0.0.1:5432 ─▶│   PostgreSQL 18 on port 5432    │
 │ Beekeeper Studio / pgAdmin │── 127.0.0.1:5432 ─▶│   data → volume pennywise_pgdata│
 └────────────────────────────┘                    └─────────────────────────────────┘
```

- The API, the Prisma CLI and the GUI all run **on the host**, so they reach the database at `127.0.0.1` on the published port. They use the same database, user and password (`DATABASE_URL` / `POSTGRES_*` in `.env`).
- **Service-name networking:** another container in the same Compose project would use the service name `postgres` as the host name instead (for example `postgres:5432`). We don't run the API in Docker in the MVP, so `127.0.0.1` is what we use.
- The port is published on `127.0.0.1` only, so other machines on the network can't reach the database.
- The API and web app run directly on the host with Node.js.

## Developer tooling (implemented)

- Prettier is installed locally and pinned; it is run with `npm run format` and checked with `npm run format:check`.
- Claude Code hooks are configured in `.claude/settings.json`:
  - **PreToolUse** (`Bash` and `PowerShell` tools): `scripts/hooks/guard-shell.mjs` denies recognizable destructive commands.
  - **PostToolUse** (`Edit`, `Write` and `MultiEdit` tools): `scripts/hooks/format-file.mjs` formats the edited JS/TS file with local Prettier.
- CI (`.github/workflows/ci.yml`) runs `npm ci` (which also runs `prisma generate`), Prisma schema validation, the format check, the hook tests, lint, typecheck, unit tests, e2e tests and build on Node from `.nvmrc`. A `postgres:18.6` service container gives the e2e tests a throwaway database.

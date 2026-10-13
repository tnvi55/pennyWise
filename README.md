# PennyWise

A learning-first, single-user personal expense tracker built with React, NestJS, PostgreSQL and Prisma in strict TypeScript. It is local only, unauthenticated and INR only.

> **Status:** Phase 6 (React frontend): the MVP runs end to end. A browser app (dashboard, transactions, categories) talks to the NestJS API, which stores data in PostgreSQL in Docker. See [docs/progress.md](docs/progress.md).

## Prerequisites

| Tool                            | Version                 | Needed from |
| ------------------------------- | ----------------------- | ----------- |
| Node.js                         | 24.9+ (see `.nvmrc`)    | Phase 0     |
| npm                             | 11+ (bundled with Node) | Phase 0     |
| Git                             | any recent              | Phase 0     |
| Docker Desktop with Compose v2+ | recent stable           | Phase 2     |
| Beekeeper Studio **or** pgAdmin | recent stable           | Phase 2     |

## Setup

```bash
npm ci                  # install exact versions from package-lock.json
npm run format:check    # verify formatting
npm run test:hooks      # test the Claude Code hook scripts
```

Copy `.env.example` to `.env` and keep the placeholder values for local work. Never commit `.env`.

`npm ci` also runs `prisma generate`, which writes the typed Prisma client to `apps/api/src/generated/prisma` (gitignored).

## Database (PostgreSQL in Docker)

Start Docker Desktop first. Compose reads `POSTGRES_*` from the root `.env`.

```bash
docker compose up -d            # start PostgreSQL in the background
docker compose ps               # STATUS should show "healthy"
docker compose logs postgres    # server logs
docker compose down             # stop and remove the container; data is kept in the volume
```

> ⚠️ **`docker compose down -v` deletes the `pennywise_pgdata` volume, which holds all your local data.** Use plain `down`.

Then create the tables and add sample data:

```bash
npm run db:migrate   # apply migrations in prisma/migrations (creates the database tables)
npm run db:seed      # insert synthetic categories and transactions; safe to run again
```

- `db:migrate` runs `prisma migrate dev`. It also creates a new migration if you changed `schema.prisma`; review the generated SQL before committing it.
- `db:deploy` runs `prisma migrate deploy`, which only applies committed migrations (CI and shared environments).
- The seed never deletes rows, and re-running it doesn't create duplicates.

### Connect a GUI (Beekeeper Studio or pgAdmin)

Use the same values as `DATABASE_URL` in `.env`, so the GUI sees exactly the database Prisma uses:

| Field    | Value                                    |
| -------- | ---------------------------------------- |
| Host     | `127.0.0.1`                              |
| Port     | `POSTGRES_PORT` (default `5432`)         |
| Database | `POSTGRES_DB` (default `pennywise_dev`)  |
| User     | `POSTGRES_USER` (default `pennywise`)    |
| Password | `POSTGRES_PASSWORD` from your `.env`     |
| SSL      | off / `disable` (local development only) |

- **Beekeeper Studio:** New connection → PostgreSQL → fill in the fields → Test → Connect. The tables are under `public`.
- **pgAdmin:** right-click Servers → Register → Server. Name it `PennyWise`, then fill in the Connection tab (Host name/address, Port, Maintenance database, Username, Password) and set SSL mode to `disable` on the Parameters tab.

Try the queries in [docs/sql-basics.md](docs/sql-basics.md).

## Run the API

```bash
npm run dev:api         # NestJS in watch mode on http://localhost:3000
```

- Health check: http://localhost:3000/api/v1/health returns `{"status":"ok","timestamp":"<ISO 8601 UTC time>"}`.
- Swagger UI: http://localhost:3000/api/docs (raw OpenAPI JSON at `/api/docs-json`).
- The server binds to `127.0.0.1` only, and CORS allows only `CORS_ORIGIN`.
- An invalid `NODE_ENV`, `PORT`, `CORS_ORIGIN` or `DATABASE_URL` stops startup with a list of what is wrong.
- The API starts even while PostgreSQL is down; Prisma connects on the first database query.
- Categories: `GET/POST /api/v1/categories`, `PATCH/DELETE /api/v1/categories/:id`. Examples are in [docs/api-design.md](docs/api-design.md#categories-implemented-phase-3); you can also try them in Swagger.
- Transactions: `GET/POST /api/v1/transactions` (`?month=YYYY-MM&type=&categoryId=&page=&pageSize=`), `GET/PATCH/DELETE /api/v1/transactions/:id`. Amounts are strings such as `"125.50"`, and dates are `YYYY-MM-DD`. See [api-design.md](docs/api-design.md#transactions-implemented-phase-4).
- Summary: `GET /api/v1/summary?month=YYYY-MM` returns income, expenses, net and expenses by category for that month. See [api-design.md](docs/api-design.md#summary-implemented-phase-5).

## Run the web app

Start Docker Desktop, then run the API and the web app in two terminals:

```bash
npm run dev:api      # http://localhost:3000/api/v1
npm run dev:web      # http://localhost:5173
```

- Open **http://localhost:5173**. Use `localhost`, not `127.0.0.1`: the API's CORS allows exactly `CORS_ORIGIN=http://localhost:5173`.
- Views: **Dashboard** (`#/dashboard`: monthly totals and expense breakdown), **Transactions** (`#/transactions`: filter, add, edit, delete) and **Categories** (`#/categories`: add, rename, delete).
- The app calls `VITE_API_BASE_URL` from the root `.env`. Every `VITE_` variable ends up in public browser code, so never put secrets there.
- `npm run build -w @pennywise/web` writes a static build to `apps/web/dist`.

## Tests

```bash
npm test             # API unit tests and web component tests (Vitest): no database needed
npm run test:e2e     # end-to-end tests against a real, disposable PostgreSQL test database
```

- `test:e2e` needs Docker running and **`TEST_DATABASE_URL` in your `.env`** (see `.env.example`). It points at `pennywise_test` on the same local server.
- Before anything else, the e2e setup checks that the test URL is local, that its database name ends in `_test`, and that it isn't the `DATABASE_URL` database. Then it creates the database if needed and applies the committed migrations (`prisma migrate deploy`).
- Each test starts from empty tables in `pennywise_test`. Your development data in `pennywise_dev` is never read or changed.
- CI runs the same tests against its own throwaway PostgreSQL service.

## Scripts

| Script                 | What it does                                                  |
| ---------------------- | ------------------------------------------------------------- |
| `npm run format`       | Format the repository with Prettier                           |
| `npm run format:check` | Fail if any file is not formatted (used in CI)                |
| `npm run test:hooks`   | Run Node's built-in test runner on `scripts/hooks/*.test.mjs` |
| `npm run dev:api`      | Start the API in watch mode                                   |
| `npm run dev:web`      | Start the web app (Vite) on http://localhost:5173             |
| `npm run lint`         | ESLint in every workspace                                     |
| `npm run typecheck`    | `tsc --noEmit` in every workspace                             |
| `npm test`             | Unit tests (Jest) in every workspace                          |
| `npm run test:e2e`     | API end-to-end tests (Jest + Supertest, real test database)   |
| `npm run build`        | Production build of every workspace                           |
| `npm run db:migrate`   | Apply (and, after schema changes, create) Prisma migrations   |
| `npm run db:deploy`    | Apply committed migrations only                               |
| `npm run db:seed`      | Insert synthetic development data (repeatable)                |
| `npm run db:validate`  | Check `schema.prisma` (used in CI)                            |

Jest runs with `node --experimental-vm-modules` because NestJS 12 packages are ESM-only; see [ADR 0002](docs/adr/0002-node-24-and-jest-esm.md). The resulting `ExperimentalWarning` in test output is expected.

## Claude Code hooks

The project's shared settings live in [.claude/settings.json](.claude/settings.json). This file is committed and applies to anyone using Claude Code in this folder.

| Event       | Tools                        | Script                          | Effect                                                                                                                                                 |
| ----------- | ---------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PreToolUse  | `Bash`, `PowerShell`         | `scripts/hooks/guard-shell.mjs` | Denies force push, `reset --hard`, `git clean -f`, broad recursive deletes, DB reset/drop/truncate, Docker volume deletion. Fails closed on bad input. |
| PostToolUse | `Edit`, `Write`, `MultiEdit` | `scripts/hooks/format-file.mjs` | Formats the edited JS/TS file inside the repo with the local Prettier. Skips `node_modules`, build and generated output, and paths outside the repo.   |

- **Activation:** the hooks need Node on `PATH` and `npm ci` already run. Claude Code watches settings files and reloads them automatically; start a new session if they don't show up.
- **Inspect:** run `/hooks` inside Claude Code to list the active hooks.
- **Disable temporarily:** add `"disableAllHooks": true` to your personal `.claude/settings.local.json`, which is gitignored.
- **Limits:** the guard matches command text, so it is a safety net and not a security boundary.
  - It can be bypassed by obfuscation.
  - It can also block harmless commands that mention a dangerous one, such as `echo "git reset --hard"`.
  - Claude Code's normal permission prompts stay on.

## Layout

```
apps/api/      # NestJS API (Phase 1); prisma/ holds schema, migrations and seed (Phase 2)
apps/web/      # React + Vite browser app (Phase 6)
compose.yaml   # local PostgreSQL in Docker (Phase 2)
docs/          # requirements, architecture, API design, progress, ADRs
scripts/hooks/ # Claude Code hook scripts and tests
```

## Documentation

- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [API design](docs/api-design.md)
- [Progress](docs/progress.md)
- [ADR 0001: monorepo and architecture](docs/adr/0001-monorepo-and-architecture.md)
- [SQL basics with PennyWise](docs/sql-basics.md)
- [ADR 0002: Node 24 and Jest with ESM-only NestJS](docs/adr/0002-node-24-and-jest-esm.md)
- [ADR 0003: Prisma 7 and PostgreSQL 18](docs/adr/0003-prisma-7-and-postgres-18.md)
- [ADR 0004: Money and dates at the API boundary](docs/adr/0004-money-and-dates-at-the-api-boundary.md)
- [ADR 0005: Frontend stack](docs/adr/0005-frontend-stack.md)
- [Implementation plan](plan.md) and [Claude instructions](CLAUDE.md)

# PennyWise: start here

_Last updated: 2026-10-13 · `main` at `00b8b97` (CI green) · Status: MVP complete (Phases 0–7)_

One page for anyone, a person or a fresh Claude Code session, picking this repo up. It links to the detailed docs and doesn't repeat them.

## 1. What this is

A learning-first, single-user personal expense tracker: **React + Vite** → **NestJS** → **Prisma** → **PostgreSQL** (in Docker), all in strict TypeScript. It is local only, INR only and unauthenticated, so not for public hosting ([security notes](docs/security.md)).

## 2. What's built

| Area     | State                                                                                                      | Details                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| API      | Health, categories CRUD, transactions CRUD (filters, pagination, merged-PATCH validation), monthly summary | [api-design.md](docs/api-design.md)                                 |
| Database | Two tables, CHECK/UNIQUE/FK constraints, one migration, repeatable seed                                    | [sql-basics.md](docs/sql-basics.md)                                 |
| Web app  | Dashboard, Transactions, Categories views                                                                  | [architecture.md](docs/architecture.md#web-app-implemented-phase-6) |
| Quality  | Lint, typecheck, 152 API unit + 150 e2e (real Postgres) + 77 web tests, CI on every PR and push to `main`  | [progress.md](docs/progress.md)                                     |

**Open items** live in the [parking lot](docs/parking-lot.md). The most important one is the manual browser check of the MVP flows ([demo checklist](docs/demo-checklist.md), sections B–D).

## 3. Run it

```bash
cp .env.example .env && npm ci
docker compose up -d && npm run db:migrate && npm run db:seed
npm run dev:api     # http://localhost:3000/api/docs (Swagger)
npm run dev:web     # http://localhost:5173 (use localhost, not 127.0.0.1)
```

Full steps, every environment variable and troubleshooting: [README](README.md).

Common snags:

- Docker Desktop needs virtualization enabled in the BIOS.
- If port 5173 is busy, an old `dev:web` is still running, and Vite refuses to switch ports because CORS allows only `:5173`.

## 4. Where things are

```
apps/api/      NestJS: src/<feature>/{controller,service,dto}, prisma/{schema,migrations,seed}, test/ (e2e)
apps/web/      React: src/api (typed client + guards + queries), src/features/<view>, src/lib (money, dates)
docs/          architecture, api-design, sql-basics, progress (phase log), adr/, plans/, demo-checklist, security
.claude/       shared Claude Code settings and hooks (scripts/hooks/)
CLAUDE.md      rules Claude follows in this repo · plan.md: the original requirements and phases
```

## 5. Decisions you shouldn't undo without discussion

Each one is recorded in an ADR in [docs/adr/](docs/adr/):

- **Money** is a decimal **string** end to end: `DECIMAL(12,2)` in the database, totals via SQL `sum()`, no JS floats (ADR 0004).
- **Dates** are `YYYY-MM-DD` in a `DATE` column, converted at a UTC boundary; no timezone drift (ADR 0004).
- **Layers:** the controller handles HTTP only, DTOs validate, services hold the rules, and the database constraints have the final word (ADR 0001).
- **e2e tests** run only against a local database whose name ends in `_test`, never `DATABASE_URL` (`apps/api/test/test-database.ts`).
- **Toolchain:** Node 24 and Jest with `--experimental-vm-modules` (ADR 0002); Prisma 7 with the pg adapter (ADR 0003); TanStack Query, Tailwind and a hash router (ADR 0005).

## 6. How work is done here

- **One phase or change per branch:** plan, then approval, then implementation, then checks, then a commit authorized by the maintainer. Approved plans are saved in [docs/plans/](docs/plans/).
- **Before a commit:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build`.
- **Report issues** with the GitHub issue templates (bug, feature, improvement, task). PRs use the PR template.
- **Ideas and deferred work** go in the [parking lot](docs/parking-lot.md), not in code comments.

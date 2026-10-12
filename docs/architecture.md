# Architecture

> Status: repository tooling (Phase 0) and the API skeleton (Phase 1) are implemented. Sections are marked as they are implemented.

## Repository layout

```
.
├── apps/
│   ├── api/          # NestJS server (Phase 1, implemented)
│   └── web/          # React + Vite client (Phase 6, planned)
├── docs/             # requirements, architecture, API design, progress, ADRs
├── scripts/hooks/    # Claude Code hook scripts + their tests (Phase 0, implemented)
├── .claude/          # shared Claude Code settings (hooks, deny rules)
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
├── config/env.validation.ts # NODE_ENV, PORT, CORS_ORIGIN checked once at startup
├── common/dto/              # ErrorResponseDto, the documented error shape
└── health/                  # HealthModule → HealthController → HealthService
```

- **Module:** groups a feature's controller and providers. `AppModule` imports each feature module.
- **Controller:** maps an HTTP route to a method. `HealthController` handles `GET /api/v1/health`.
- **Provider/service:** a class Nest creates once and injects wherever it is declared in a constructor. This is dependency injection (DI).
- **Startup order:** `ConfigModule` validates the environment before any module starts, so a bad `.env` fails fast instead of failing on the first request.
- **e2e tests** call the same `configureApp()` as `main.ts`, so they test the real prefix, pipes, CORS and Swagger setup.
- **404s:** unknown routes under `/api/v1` return the JSON error shape. Paths outside the prefix get Express's default HTML 404, because Nest registers no handler there.

## Request flow (planned)

```
Browser (React page)
  → typed fetch client  GET /api/v1/transactions?month=2026-10
  → NestJS: global ValidationPipe checks query DTO
  → TransactionsController  (HTTP only: params in, status code out)
  → TransactionsService     (business rules: category/type match, pagination)
  → PrismaService           (typed, parameterized queries)
  → PostgreSQL              (tables, constraints, Decimal and DATE columns)
```

Each layer has one job:

- **Controller:** handles HTTP.
- **DTO:** validates input.
- **Service:** enforces business rules.
- **Prisma:** talks to the database.

There is no generic repository layer or CQRS.

## Local runtime (planned)

- PostgreSQL runs in Docker Compose (official image, named volume, port published on `127.0.0.1` only).
- The API and web app run directly on the host with Node.js.
- A GUI client (Beekeeper Studio or pgAdmin) connects to the same database as Prisma.

## Developer tooling (implemented)

- Prettier is installed locally and pinned; it is run with `npm run format` and checked with `npm run format:check`.
- Claude Code hooks are configured in `.claude/settings.json`:
  - **PreToolUse** (`Bash` and `PowerShell` tools): `scripts/hooks/guard-shell.mjs` denies recognizable destructive commands.
  - **PostToolUse** (`Edit`, `Write` and `MultiEdit` tools): `scripts/hooks/format-file.mjs` formats the edited JS/TS file with local Prettier.
- CI (`.github/workflows/ci.yml`) runs `npm ci`, the format check, the hook tests, lint, typecheck, unit tests, e2e tests and build on Node from `.nvmrc`.

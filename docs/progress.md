# Progress

| Phase | Name                     | Status                                      |
| ----- | ------------------------ | ------------------------------------------- |
| 0     | Repository and standards | Complete (commit 5e97bc8, CI green)         |
| 1     | Backend skeleton         | Complete (commit c215d40 on main, CI green) |
| 2     | PostgreSQL + Prisma      | Complete (commit d8aa3c6 on main, CI green) |
| 3     | Categories API           | Implemented, verified; awaiting commit      |
| 4     | Transactions API         | Not started                                 |
| 5     | Summary API              | Not started                                 |
| 6     | React frontend           | Not started                                 |
| 7     | Production-style quality | Not started                                 |

## Phase 0: repository and standards

Branch: `chore/phase-0-setup`, committed as `5e97bc8` and pushed to `origin` (https://github.com/tnvi55/pennyWise). `main` points at the same commit.

### Environment observed

- Node v22.14.0, npm 10.9.2, Git 2.41.0 (Windows, system `core.autocrlf=true`), Docker 29.5.2, Compose v5.1.3.
- Claude Code is running as the VS Code extension; there is no `claude` CLI on `PATH`.

### Completed scope

- Git repository and feature branch.
- `.gitignore`: `.env*` is ignored except `.env.example`; also ignored are dumps, `.tmp/` and `.claude/settings.local.json`.
- `.gitattributes`: forces LF line endings.
- `.editorconfig` and `.nvmrc` (`22`).
- Root `package.json`:
  - npm workspaces (`apps/*`), `engines.node >=22.12.0`, `packageManager npm@10.9.2`.
  - Scripts: `format`, `format:check` and `test:hooks`. No placeholder scripts.
- Dependency batch: `prettier@3.9.9` (exact pin, devDependency). `package-lock.json` was generated.
- Prettier config: `.prettierrc.json` and `.prettierignore`. `CLAUDE.md`, `plan.md`, the lockfile, generated code and migration SQL are excluded.
- `.env.example` with placeholder values only.
- Claude Code configuration in `.claude/settings.json`:
  - Permission deny rules for reading `.env`.
  - PreToolUse hook `scripts/hooks/guard-shell.mjs` for the `Bash` and `PowerShell` tools.
  - PostToolUse hook `scripts/hooks/format-file.mjs` for the `Edit`, `Write` and `MultiEdit` tools.
  - Both hooks use exec form (`command: node`, `args: [...]`), so no shell is involved.
- Hook tests in `scripts/hooks/*.test.mjs`, using Node's built-in test runner.
- CI in `.github/workflows/ci.yml`:
  - Runs `npm ci`, `format:check` and `test:hooks` on pull requests and on pushes to `main`.
  - Uses `contents: read` permissions, `actions/checkout@v7` and `actions/setup-node@v7`.
- Docs: README, `docs/requirements.md`, `docs/architecture.md`, `docs/api-design.md` (contract only) and ADR 0001.

### Verification (run on 2026-10-09, Windows 11, Node 22.14.0)

#### Script tests

Synthetic payloads only; no destructive command was executed.

| Command                | Result                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm ci`               | exit 0; 1 package, 0 vulnerabilities                                                                            |
| `npm run format:check` | exit 0; "All matched files use Prettier code style!"                                                            |
| `git check-ignore`     | `.env`, `.env.local`, `node_modules`, `.tmp/`, `.claude/settings.local.json` ignored; `.env.example` tracked    |
| Secret scan (`grep`)   | only the `.env.example` placeholder `change-me-local-only`; no real credentials                                 |
| `npm run test:hooks`   | 73 tests, 73 pass, 0 fail: 19 allowed commands, 38 denied commands, 7 hook-process checks, 9 format-file checks |

#### Real Claude Code lifecycle checks (this session, VS Code extension)

- **PostToolUse:**
  - Wrote an unformatted scratch file `hook-lifecycle-check.ts` with the Write tool.
  - Claude Code reported "PostToolUse hook modified … after your edit".
  - The file content became `const value = { a: 1, b: 'two' };`. The scratch file was then deleted.
- **PreToolUse (allow path):** ordinary `cat`, `rm <scratch file>` and `git status` ran normally.
- **PreToolUse (deny path, Bash):** the harmless `echo "git reset --hard"` was blocked with "Blocked by project guard-shell hook: git reset --hard discards work…".
- **PreToolUse (deny path, PowerShell):** the harmless `Write-Output "docker compose down -v"` was blocked with the Docker-volume reason.
- No destructive command was actually run.

### Pending manual verification

- Run `/hooks` in Claude Code and confirm that both hooks are listed under Project settings.
- CI verified: GitHub Actions run 37900331769 on the push to `main` succeeded (npm ci, format:check, test:hooks).
- Git identity checked: global `user.name=Tanvi`, `user.email=tanvi.jain@fiftyfivetech.io`. Remote `origin` is https://github.com/tnvi55/pennyWise.

### Known limitations

- The guard matches command text: it is a safety net, not a security boundary.
  - It can be bypassed by obfuscation.
  - It blocks harmless text that mentions a dangerous command, such as `echo` or `grep` patterns.
- The format hook only handles JS/TS files. JSON, Markdown and YAML are checked by `format:check` and CI instead.

### Next task (Phase 0)

- On GitHub, set the default branch to `main` (manual step).

## Phase 1: backend skeleton

Branch: `feature/backend-setup`, committed as `c215d40` and fast-forwarded into `main`. GitHub Actions run 38248984534 on `main` succeeded: every step, including lint, typecheck, unit, e2e and build.

### Environment

- Node v24.21.0 and npm 11.19.0, installed with nvm-windows 1.2.2. Node 22.14.0 is still installed.
- Upgrading from Node 22 was needed for Jest to load NestJS 12's ESM-only packages; see [ADR 0002](adr/0002-node-24-and-jest-esm.md).

### Completed scope

- `apps/api` (`@pennywise/api`): NestJS 12, TypeScript 6 strict (`noUncheckedIndexedAccess` on), ESLint 10 with typescript-eslint, Jest 30, ts-jest and Supertest. All versions pinned exactly.
- `main.ts` listens on `127.0.0.1` only.
- `app.setup.ts` is shared by `main.ts` and the e2e tests. It sets:
  - the `/api/v1` global prefix;
  - a global `ValidationPipe` (whitelist, `forbidNonWhitelisted`, transform);
  - CORS with a single-origin allow-list from `CORS_ORIGIN`;
  - Swagger at `/api/docs`, with JSON at `/api/docs-json`.
- Environment validation (`config/env.validation.ts`): `NODE_ENV` must be one of `development`, `test` or `production`; `PORT` must be an integer from 1 to 65535; `CORS_ORIGIN` must be a single http(s) origin. Startup stops with one readable error listing every problem.
- `GET /api/v1/health` → `200 {"status":"ok","timestamp":"<ISO 8601 UTC>"}`, documented with `HealthResponseDto`. `ErrorResponseDto` documents the error shape.
- Root scripts: `dev:api`, `lint`, `typecheck`, `test`, `test:e2e` and `build`.
- CI now also runs lint, typecheck, unit tests, e2e tests and build.
- `.env.example` gains `NODE_ENV`.

### Fixes made during verification (this session)

- **Jest:** ESM-only Nest packages failed with `ERR_REQUIRE_ESM` under plain `jest`, even on Node 24.21. The previous note said plain `jest` would work; that was wrong. Jest's native require(ESM) needs `vm.SourceTextModule`, which exists only with `--experimental-vm-modules`. The API's test scripts now run Jest through `node --experimental-vm-modules` (ADR 0002).
- **CORS:** a plain string `origin` makes `cors` send `Access-Control-Allow-Origin: http://localhost:5173` to every caller. Browsers would still block other origins, but the API now uses an allow-list array, so the header is left off for any other origin.
- **404 test:** Nest 12 adds its JSON 404 handler only under the global prefix, so `/health` gets Express's default HTML 404. The e2e test now checks that `/health` returns 404, and that `/api/v1/unknown` returns the JSON error shape.

### Verification (run on 2026-10-09, Windows 11, Node 24.21.0, npm 11.19.0)

| Command                | Result                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`               | succeeded; lockfile already in sync (`npm install --package-lock-only` made no further change)                              |
| `npm audit --omit=dev` | 0 vulnerabilities in production dependencies                                                                                |
| `npm audit`            | 20 moderate, all in dev tooling via `sprintf-js`; not fixed (`audit fix --force` would make breaking changes)               |
| `npm run format:check` | exit 0                                                                                                                      |
| `npm run test:hooks`   | exit 0; 73 pass, 0 fail                                                                                                     |
| `npm run lint`         | exit 0                                                                                                                      |
| `npm run typecheck`    | exit 0                                                                                                                      |
| `npm test`             | exit 0; 2 suites, 20 tests pass                                                                                             |
| `npm run test:e2e`     | exit 0; 1 suite, 8 tests pass (health, prefix 404, JSON 404 shape, Swagger UI, OpenAPI schemas, CORS allow/deny, preflight) |
| `npm run build`        | exit 0                                                                                                                      |

#### Live API check

The built server (`node dist/main.js`) was started with synthetic environment variables (`PORT=3001`) and checked with `curl`:

- `GET /api/v1/health` → 200 `application/json` `{"status":"ok"}`.
- `GET /api/v1/unknown` → 404 `{"message":"Cannot GET /api/v1/unknown","error":"Not Found","statusCode":404}`.
- `GET /health` → 404.
- `/api/docs` → 200 HTML. `/api/docs-json` → OpenAPI 3.0.0, title "PennyWise API", path `/api/v1/health`, schemas `HealthResponseDto` and `ErrorResponseDto`.
- CORS: `Origin: http://localhost:5173` gets the allow header; `Origin: http://evil.example` gets no allow header. The preflight (OPTIONS, PATCH) returns 204 with the allowed methods.
- Requests to the machine's LAN IP (172.24.16.1:3001) were not reachable, which confirms the server binds to localhost only.
- Invalid environment (`NODE_ENV=staging PORT=abc CORS_ORIGIN=not-a-url`): startup stopped with exit 1, and the error listed every invalid variable.

### Exercise: health timestamp (2026-10-12)

- `HealthResponseDto` has a new `timestamp` field (`format: date-time`). `HealthService` returns `new Date().toISOString()`.
- Unit test: the clock is frozen with `jest.useFakeTimers({ now })`, so the expected timestamp is exact.
- e2e tests: the timestamp has the ISO 8601 UTC format and lies between the request's start and end times. The OpenAPI schema lists `timestamp` as a required `string`/`date-time`.
- Re-run: `format:check`, `lint`, `typecheck` and `build` exit 0; `npm test` 20 pass; `npm run test:e2e` 8 pass.

### Pending manual verification

- Run `npm run dev:api` yourself, then open http://localhost:3000/api/docs in a browser and try the health endpoint.

### Known limitations

- Express's default HTML 404 for paths outside `/api/v1` is accepted; every API route lives under the prefix.
- Responses still include the `X-Powered-By: Express` header. It can be removed in Phase 7.
- The 20 moderate `npm audit` findings are in dev-only tooling.

## Phase 2: PostgreSQL + Prisma

Branch: `feature/postgres-prisma`, committed as `d8aa3c6` and fast-forwarded into `main`. GitHub Actions run 38394601313 on `main` succeeded, including the new "Validate Prisma schema" step. Decisions: [ADR 0003](adr/0003-prisma-7-and-postgres-18.md).

### Completed scope (code)

- Dependency batch (approved, pinned exactly):
  - `prisma@7.10.0`, `@prisma/client@7.10.0`, `@prisma/adapter-pg@7.10.0`;
  - `pg@8.23.1`, `@types/pg@8.23.1`;
  - `tsx@4.23.15`.
- `compose.yaml`:
  - one `postgres:18.6` service, with credentials from `.env` (required: `${VAR:?}`);
  - port `127.0.0.1:${POSTGRES_PORT:-5432}`;
  - named volume `pennywise_pgdata` at `/var/lib/postgresql`;
  - `pg_isready` health check and `restart: unless-stopped`.
- `apps/api/prisma.config.ts`: schema, migrations path, `tsx` seed and URL. Loads `.env` with `process.loadEnvFile` when it exists.
- `apps/api/prisma/schema.prisma`:
  - `CategoryType` enum and the `categories` / `transactions` tables (snake_case);
  - unique `(name, type)`;
  - `Decimal(12,2)`, `DATE`, `VarChar(80)` and `VarChar(250)`;
  - FK with `onDelete: Restrict`;
  - indexes on `category_id` and on `(date, created_at, id)`, all descending.
- `apps/api/prisma/seed.ts`: 9 categories and 15 transactions across Sep–Oct 2026, including the 0.10 + 0.20 pair. Upserts with `update: {}`; never deletes.
- `PrismaModule` (global) and `PrismaService` (extends the generated client, `PrismaPg` adapter, lazy connect, disconnect on shutdown).
- Env validation: `DATABASE_URL` is required and must be a `postgres(ql)://` URL with a host and database. The error never echoes the value. `test/setup-env.ts` sets a synthetic URL.
- Generated client is gitignored and ESLint-ignored. Jest `moduleNameMapper` maps its `.js` imports to the `.ts` sources.
- Scripts:
  - API: `postinstall` (`prisma generate`), `db:generate`, `db:validate`, `db:migrate`, `db:deploy`, `db:seed`;
  - root: `db:migrate`, `db:deploy`, `db:seed`, `db:validate`.
- CI: `npm run db:validate` added after `npm ci`.
- README: database section (Compose commands, `down -v` warning, migrate and seed, GUI connection).
- Migration `20261012175401_init`, generated by Prisma, plus hand-added `transactions_amount_positive` (`CHECK (amount > 0)`) and `categories_name_not_blank` (`CHECK (btrim(name) <> '')`).
- Docs:
  - [sql-basics.md](sql-basics.md): `CREATE TABLE`, `SELECT`, `JOIN`, `GROUP BY`, constraints, indexes with `EXPLAIN`, migration history, all with real output;
  - architecture: database layer, image/container/volume/Compose, host vs service-name networking;
  - ADR 0003.

### Environment

- **Docker Desktop:** 4.75.0, engine 29.8.2 (WSL 2 backend).
- **Virtualization fix:** it was off in the laptop firmware (BIOS). After you enabled it, Docker's first start hung; a factory reset in Docker Desktop fixed that.

### Verification (2026-10-12, Node 24.21.0, PostgreSQL 18.6)

#### Database

| Check                                                                                                | Result                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker compose up -d`, then `ps`                                                                    | `pennywise-postgres-1` reports `Up (healthy)`. Port is `127.0.0.1:5432->5432/tcp` only. Volume is `pennywise_pgdata`.                                                                                                                                                                                   |
| `prisma migrate dev --name init --create-only`, then CHECKs added by hand, then `prisma migrate dev` | `20261012175401_init` applied. "Database schema is up to date!" No drift is reported for the hand-added CHECKs.                                                                                                                                                                                         |
| `psql`: `\dt`, `pg_constraint`, `pg_indexes`, `_prisma_migrations`                                   | 3 tables. PK, FK (`ON DELETE RESTRICT`), unique `(name, type)`, both CHECKs, both indexes, 1 applied migration.                                                                                                                                                                                         |
| Constraints, each in `BEGIN … ROLLBACK`                                                              | amount 0 → CHECK violation; amount −5 → CHECK violation; duplicate `(Groceries, EXPENSE)` → unique violation; `(Groceries, INCOME)` → allowed; blank name → CHECK violation; delete referenced Rent → FK RESTRICT violation; `10000000000.00` → numeric overflow; counts unchanged afterwards (9 / 15). |
| `npm run db:seed` × 2                                                                                | Both runs: "Database now has 9 categories and 15 transactions".                                                                                                                                                                                                                                         |
| Seed leaves your own rows alone                                                                      | Added a temporary category, re-seeded: 10 categories, temporary row kept. The temporary row was then deleted by its exact id.                                                                                                                                                                           |
| `docker compose restart postgres`                                                                    | Healthy again; 9 categories and 15 transactions.                                                                                                                                                                                                                                                        |
| Prisma client round trip (temporary script, deleted)                                                 | `DATE` 2026-09-30 → `2026-09-30T00:00:00.000Z`. Amount is a `Decimal`, `2875.20`. SQL sum of 0.10 + 0.20 is `0.30`. The September range `[09-01, 10-01)` returns 8 rows. The join works.                                                                                                                |
| `EXPLAIN` on the month filter                                                                        | `Index Scan using transactions_date_created_at_id_idx`, with no separate Sort step.                                                                                                                                                                                                                     |

**Finding for Phase 4:** PostgreSQL silently rounds `1.005` to `1.01` in a `DECIMAL(12,2)` column. The API must reject amounts with more than 2 decimal places before they reach the database.

#### Code checks

| Command                                                      | Result                                                                                                |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `npm ci` (generated client removed first, no `DATABASE_URL`) | 730 packages; `postinstall` regenerated `src/generated/prisma`                                        |
| `npm run format:check`                                       | exit 0                                                                                                |
| `npm run test:hooks`                                         | exit 0; 73 pass                                                                                       |
| `npm run lint`                                               | exit 0                                                                                                |
| `npm run typecheck`                                          | exit 0 (now includes `prisma/` and `prisma.config.ts`)                                                |
| `npm test`                                                   | exit 0; 27 tests (7 new `DATABASE_URL` cases, including that the password never appears in the error) |
| `npm run test:e2e`                                           | exit 0; 8 tests with `PrismaModule` loaded                                                            |
| `npm run build`                                              | exit 0                                                                                                |
| `npm run db:validate`                                        | exit 0; the schema is valid                                                                           |

### Pending manual verification

- GUI check done (2026-10-13): pgAdmin 4 v9.18 connected to `127.0.0.1:5432/pennywise_dev` as `pennywise`. The expenses-by-category query for September 2026 returned the expected rows (Rent 22000.00, Groceries 6325.95, Utilities 1899.50, Eating out 1240.10, Transport 640.00).

### Known limitations

- The project's shell guard blocks any command whose text mentions deleting a volume, including documentation text written through a shell. Docs containing that text are written with the editor tools instead.

## Phase 3: Categories API

Branch: `feature/categories-api` (from `main` at `d8aa3c6`). Not committed. No new dependencies.

### Completed scope

- `src/categories/`:
  - `CategoriesModule`, `CategoriesController` (HTTP only) and `CategoriesService` (rules, Prisma calls, error mapping);
  - DTOs: create, update, list query and response. A shared `IsCategoryName()` decorator trims, then requires a string of 1–80 characters.
- Endpoints:
  - `GET /api/v1/categories?type=` returns a sorted array (name, type, id);
  - `POST` → 201;
  - `PATCH /:id` renames only; `type` is refused as an unknown field;
  - `DELETE /:id` → 204.
- Error mapping in the service. The database constraint decides; there are no racy pre-checks:
  - P2002 → 409;
  - P2003 (FK RESTRICT) → 409;
  - P2025 → 404;
  - anything else is re-thrown.
- `ParseUUIDPipe` gives 400 for a malformed `:id`.
- `UnhandledExceptionFilter` (global): unexpected errors become `500 { statusCode, error, message }` with generic text; the details are logged on the server only.
- Swagger documents every route, with response, 400, 404 and 409 schemas.
- Isolated test database:
  - `test/test-database.ts`: the guard (local host, name ending in `_test`, not the `DATABASE_URL` database, no password in messages), database creation and `prisma migrate deploy`;
  - `test/global-setup.ts` runs those once per e2e run;
  - `test/setup-e2e-env.ts` points the API at `TEST_DATABASE_URL`;
  - `test/db-helpers.ts` re-checks the guard, then empties the two app tables between tests;
  - `test:e2e` uses `--runInBand`.
- `TEST_DATABASE_URL` added to `.env.example`.
- CI: a `postgres:18.6` service container with throwaway credentials, and `TEST_DATABASE_URL` set on the e2e step.
- Docs: category contract with JSON examples in `api-design.md`, a README "Tests" section, and the category request flow plus error mapping in `architecture.md`.

### Verification (2026-10-13, Node 24.21.0, PostgreSQL 18.6)

The e2e runs used a throwaway `postgres:18.6` container on `127.0.0.1:5440`, set up like CI (`--rm`, CI-only credentials, stopped afterwards). At that point your `.env` didn't have `TEST_DATABASE_URL` yet; see the manual verification below.

| Command                                             | Result                                                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`                              | exit 0                                                                                                                                            |
| `npm run test:hooks`                                | exit 0; 73 pass                                                                                                                                   |
| `npm run lint`                                      | exit 0 (two lint errors in new test files fixed first)                                                                                            |
| `npm run typecheck`                                 | exit 0                                                                                                                                            |
| `npm test`                                          | exit 0; 4 suites, 42 tests (12 service, 3 filter)                                                                                                 |
| `npm run test:e2e`                                  | exit 0; 3 suites, 60 tests (categories, test-DB guard, Phase 1 skeleton). Passed on a fresh database and again with the database already present. |
| `npm run build`                                     | exit 0                                                                                                                                            |
| `npm run db:validate`                               | exit 0                                                                                                                                            |
| `npm run test:e2e` without `TEST_DATABASE_URL`      | stops in globalSetup: "TEST_DATABASE_URL is not set…"; nothing touched                                                                            |
| `npm run test:e2e` with a database named `postgres` | stops: must end in "_test"                                                                                                                        |
| Test DB after a run                                 | `pennywise_test` created, migration `20261012175401_init` applied, 31 inserts and 30 deletes recorded by PostgreSQL, tables empty                 |
| Dev DB before and after every run                   | 9 categories, 15 transactions (unchanged)                                                                                                         |

#### Live API check against the dev database (`node dist/main.js`, port 3001)

- `GET` returned all 9 seed categories in the documented order. `?type=INCOME` returned Freelance, Other and Salary.
- `POST "  Zz Live Check  "` → 201, with the name trimmed. The same request again → 409, `Category "Zz Live Check" (EXPENSE) already exists`.
- `PATCH` rename → 200 with a newer `updatedAt`. `PATCH` with `type` → 400, `property type should not exist`.
- `DELETE` of the scratch category → 204 with an empty body. The count went back to 9.
- `DELETE` Rent (used by transactions) → 409. An unknown UUID → 404. `abc` → 400. `type: SAVINGS` → 400.
- `/api/docs-json` lists `/api/v1/categories` and `/api/v1/categories/{id}`.

### Pending manual verification

- Done (2026-10-13): `TEST_DATABASE_URL` added to your `.env`. `npm run test:e2e` on your machine against local `pennywise_test`: 3 suites, 60 tests pass. The dev DB still has 9 categories and 15 transactions.
- Optional: try the category endpoints in Swagger (`npm run dev:api`, then http://localhost:3000/api/docs).
- CI on GitHub, including the new Postgres service, runs after a push to `main` or a PR.

### Next task

1. Commit authorized. Proposed message: `feat(api): add categories CRUD with real-postgres e2e tests`.
2. Then Phase 4 (Transactions API), when you instruct.

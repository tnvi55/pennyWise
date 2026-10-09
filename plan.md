# PennyWise — Implementation Plan

## 1. Goal
Build a small, professional, single-user personal expense tracker for learning React, Node.js, NestJS, PostgreSQL, Prisma, REST API engineering, testing, OpenAPI, CI, and Git workflows. Prioritize understanding and maintainability over feature count.

## 2. Product scope
### MVP (required)
- Record income and expense transactions with amount, date, category, and optional note.
- List, edit, and delete transactions.
- Filter transactions by month, transaction type, and category; sort newest first.
- Manage categories (create, list, rename, delete when unused).
- Show a monthly summary: income, expenses, net balance, and expense totals by category.
- Single-user local app; no login, bank integration, recurring transactions, or multi-currency conversion in MVP.
- Default currency INR; amounts are positive monetary values, represented in the database as `Decimal(12,2)` and sent over JSON as decimal strings. Amount must be greater than zero for a transaction.

### Future scope (not MVP)
- Authentication and user-level authorization.
- Budgets and alerts; chart visualizations; CSV export; deployment.
- Only add after MVP is complete and tested.

## 3. Stack and tooling
- Frontend: React, TypeScript (strict), Vite, Tailwind CSS, React Router if needed; native fetch or a minimal typed API client.
- Backend: Node.js supported LTS, NestJS, TypeScript (strict), class-validator/class-transformer, NestJS ConfigModule.
- Data: PostgreSQL, Prisma ORM and versioned database migrations.
- Contract: Swagger/OpenAPI at `/api/docs`; REST JSON API under `/api/v1`.
- Testing: NestJS Jest unit and Supertest e2e; Vitest + React Testing Library for frontend.
- Quality: ESLint, Prettier, Git hooks optional, GitHub Actions CI.
- Local DB: Docker Compose runs only PostgreSQL, with a named persistent volume and localhost-only port publishing. Provide a manual local PostgreSQL alternative. Inspect the same database from Beekeeper Studio or pgAdmin installed on the host.
- Lock versions using a committed lockfile. Before install, check current stable compatibility for Node, NestJS, Prisma, and Vite using official documentation. Avoid experimental or release-candidate dependencies.

## 4. Repository layout
```
pennywise/
  apps/
    api/                 # NestJS server
    web/                 # React client
  docs/
    requirements.md
    architecture.md
    api-design.md
    progress.md
    adr/
      0001-monorepo-and-architecture.md
      0002-money-representation.md
  .github/workflows/ci.yml
  docker-compose.yml
  .env.example
  .gitignore
  CLAUDE.md
  plan.md
  README.md
```
Start with npm workspaces if useful; avoid complex monorepo tools.

## 5. Database design
### Category
- `id`: UUID primary key
- `name`: trimmed string, 1–80 characters; unique together with type. Case-sensitive uniqueness is sufficient for MVP.
- `type`: enum `INCOME | EXPENSE`
- `createdAt`, `updatedAt`: timestamps
- `transactions`: one-to-many relationship
- Prefer a composite unique constraint on `(name, type)` instead of `name` alone, so the same label can exist in both types.

### Transaction
- `id`: UUID primary key
- `type`: enum `INCOME | EXPENSE`
- `amount`: Decimal(12,2), strictly positive
- `date`: date-only calendar value (avoid timezone drift for expense dates)
- `note`: optional string up to 250 chars
- `categoryId`: foreign key referencing Category
- `createdAt`, `updatedAt`: timestamps
- Category type must match transaction type; enforce in service logic and e2e tests.
- Use `onDelete: Restrict` for referenced categories, returning HTTP 409 on attempted deletion.

Create the schema through Prisma migrations, not `db push` for shared development history. Explain SQL table creation, indexes, joins, aggregates, and foreign keys while implementing.

## 6. API design (`/api/v1`)
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/categories` | list categories (optional `type`) |
| POST | `/categories` | create category |
| PATCH | `/categories/:id` | rename category |
| DELETE | `/categories/:id` | delete unused category |
| GET | `/transactions` | list; filter `month=YYYY-MM`, `type`, `categoryId`; paginated |
| POST | `/transactions` | add transaction |
| GET | `/transactions/:id` | retrieve one transaction |
| PATCH | `/transactions/:id` | edit transaction |
| DELETE | `/transactions/:id` | delete transaction |
| GET | `/summary?month=YYYY-MM` | income, expense, net, and expense-by-category |

Request DTOs must reject unexpected fields and validate type, amount, date, note and category ID. Return appropriate HTTP codes: 200/201/204, 400, 404, 409, and 500. Use NestJS's normal exception conventions; don't create elaborate custom error frameworks. Always treat malformed IDs and month queries as 400. Use documented response DTOs and typed JSON shapes. Ensure Swagger accurately describes request and response examples. Never use JavaScript floating point arithmetic to calculate or aggregate currency totals; prefer PostgreSQL/Prisma Decimal operations.

## 7. UI design
Pages / views:
1. Dashboard: monthly selectors, income/expense/net cards and category breakdown (simple list first; charts later).
2. Transactions: table, month/type/category filters, loading/empty/error states, add/edit form, delete confirmation.
3. Categories: list and simple add/rename/remove flows.

Use semantic HTML, label inputs, keyboard-friendly buttons, form validation with clear feedback, and responsive layouts. Keep styling clean and minimal; don't introduce a heavy component library for MVP.

## 8. Implementation phases
Each phase requires: short concept explanation, planned file changes, implementation, verification, docs/progress update, and a proposed Git commit for review. Commit only when the developer authorizes it.

### Phase 0 — Repository and standards
- Initialize Git and root README, .gitignore, .env.example, CLAUDE.md, docs, and plan.
- Choose dependency versions; document version constraints and scripts.
- Establish npm workspaces, Prettier and an initial format check. Add lint/typecheck/test/build scripts when their apps exist; do not add fake passing placeholders.
- Create and test the two minimal Claude Code hooks described below after Prettier is installed. Document any local hook activation steps.
- Add an initial GitHub Actions format check; expand CI as each application becomes available.
- Done: repository initializes cleanly, no credentials committed, `README` explains setup.

### Phase 1 — Backend skeleton
- Create NestJS app; explain modules/controllers/providers/DI and request lifecycle.
- Global `/api/v1` prefix, config validation, validation pipe, Swagger.
- Add health endpoint `GET /api/v1/health`.
- Done: backend starts; health endpoint works; Swagger visible; lint/test/build pass.

### Phase 2 — PostgreSQL + Prisma
- Configure local PostgreSQL via Docker Compose (`postgres` service only), with env-based development credentials, a named volume, a healthcheck, and localhost-bound port (use an alternate host port if 5432 is already taken). Explain image vs container vs volume vs Compose.
- Provide `.env.example` without secrets; no production credentials in Git. Document `docker compose up -d`, `docker compose ps`, `docker compose logs postgres`, and `docker compose down` plus a warning that `down -v` deletes local database data.
- Document GUI connection for Beekeeper Studio or pgAdmin: host `127.0.0.1`, published host port, configured database/user/password, SSL mode appropriate for local development. Use the same database Prisma accesses.
- Connect Prisma with a documented compatible stable setup; explain how NestJS/Prisma and the GUI access the same Postgres instance.
- Define Category and Transaction, enum and relation; generate and apply migration.
- Seed sample categories and transactions using a reproducible seed script.
- Teach SQL `CREATE TABLE`, `SELECT`, `JOIN`, indexes, constraints and migration history.
- Done: fresh database can be migrated/seeded; inspect tables and query seeded data in Beekeeper Studio or pgAdmin; verify data survives a normal container restart; document the exact steps in README.

### Phase 3 — Categories API
- Module, controller, service, DTOs, Prisma queries.
- CRUD, validation, uniqueness/foreign-key conflict handling.
- Unit and e2e tests with real test Postgres for database behavior.
- Done: documented endpoints succeed and expected errors are tested.

### Phase 4 — Transactions API
- Add CRUD, category/type consistency rule, month filters, required pagination.
- Validate decimals and dates, implement safe query handling.
- Unit and e2e tests for success, invalid input, nonexistent IDs, category mismatch.
- Done: endpoints verified manually and with tests; no floating-point currency calculations.

### Phase 5 — Summary API
- Implement month-level income, expense, net and expense-by-category aggregates.
- Teach `GROUP BY`, `SUM`, filtering and aggregating through Prisma/SQL.
- Test empty months, correct filtering and multiple categories.
- Done: accurate totals for seed records; summary exposed in OpenAPI.

### Phase 6 — React frontend
- Vite React TS setup; Tailwind styling; typed API client.
- Transaction list/add/edit/delete, filters, dashboard, category management.
- Error/loading/empty states, accessible forms, responsive design.
- Frontend component tests with mocked API responses.
- Done: all MVP flows work through UI against backend and seeded DB.

### Phase 7 — Production-style quality gate
- Add GitHub Actions CI: install with lockfile, lint, format check, typecheck, unit tests, API e2e tests with Postgres service, builds.
- Update README: prerequisites, local setup, env vars, migrations, testing, API docs, screenshots optional.
- ADRs: architecture and decimal-money handling; architecture diagram optional.
- Verify clean-clone instructions and no secrets.
- Done: CI green and documented demonstration checklist passes.

## 9. Testing expectations
- Service unit tests mock repositories/Prisma where appropriate.
- API e2e tests use an isolated test database, migration/setup/cleanup and Supertest.
- React tests verify inputs, validation messaging, loading and error states.
- At minimum cover create/edit/delete, filtering, invalid amounts/dates, category mismatch, delete referenced category, summary correctness, and 404 cases.
- Do not claim tests pass unless actually executed; report exact commands and outcomes.

## 10. Git and PR discipline
- Branch naming: `feature/backend-setup`, `feature/transactions-api`, etc.
- Conventional-style commits such as `feat(api): add transaction creation` and `test(api): cover validation errors`.
- Small diffs, no generated build artifacts, no `.env`, no database credentials.
- Each major phase can use a PR (even for solo practice): summary, tests, screenshots if UI changed.

## 11. Claude Code operating workflow
At the start of a session, read `CLAUDE.md`, `plan.md`, `docs/architecture.md`, and `docs/progress.md` if present. Work on only the requested phase. Before editing, briefly explain the goal, concepts and changed files. Ask only when a consequential architecture choice is truly ambiguous. After implementation, execute relevant checks, honestly report failures, update progress, then propose a Git commit for user review. Don't commit or push without explicit instruction. Do not introduce authentication, Redis, complex architectures, deployment providers, or other major scope changes without approval. Explain unfamiliar NestJS/Prisma/SQL concepts in accessible terms and show the request flow.

## 12. First Claude Code instruction
Use the updated prompt in section 18.

## 13. Completion criteria
The user can clone the repository, follow README, start Postgres, migrate/seed DB, start frontend/backend, create/edit/delete/filter transactions, see correct monthly totals, access Swagger docs, run tests, and view a green CI workflow. The user can also explain the React → NestJS controller → service → Prisma → PostgreSQL flow and the reasoning behind key architecture decisions.

## 14. Detailed contracts and business rules
These decisions remove ambiguity for implementation. Document final JSON examples in docs/api-design.md before the corresponding feature.

### Money
- Currency is INR throughout; income and expense amounts are both strictly positive. Type determines their effect on balance.
- Accept amount as a JSON string such as "125.50"; reject JSON numbers, signs, exponent notation, more than two decimal places, zero, and values above 9999999999.99.
- Validate syntax and bounds using decimal-safe operations. Store as Decimal(12,2); include a SQL CHECK (amount > 0) in a migration.
- Serialize every amount and summary total as a fixed two-decimal string, including "0.00". Net balance may be negative.
- Browser inputs remain strings. Currency formatting must not become the source of arithmetic.

### Dates and filters
- Accept date as a real calendar date in YYYY-MM-DD format; reject impossible dates, datetime strings and null.
- Store with PostgreSQL DATE using the compatible Prisma mapping. If Prisma exposes Date objects, convert at the boundary using UTC consistently; always return YYYY-MM-DD.
- Month is YYYY-MM with a valid month number. Use an inclusive month start and exclusive next-month start; no client timezone conversion.
- List transactions with page=1 and pageSize=20 by default; pageSize maximum 100. Validate positive integers.
- Return { data, meta: { page, pageSize, total, totalPages } }; for an empty result totalPages is 0.
- Stable sorting: date descending, createdAt descending, id descending.
- Summary requires month and returns { month, currency: "INR", income, expenses, net, expensesByCategory: [{ categoryId, categoryName, amount }] }.
- Summary covers all matching records, independent of list pagination. Expense breakdown contains only categories with expense records.

### Category and update rules
- Category type is immutable. PATCH category changes its name only.
- A transaction category must exist and match its type. On PATCH validate the merged existing and proposed transaction, not only supplied fields.
- PATCH accepts at least one allowed field; reject an empty body. Required fields cannot be null; note may be null to clear it.
- Return 400 for malformed UUIDs, invalid fields, unknown category references in transaction input, and category/type mismatch; 404 for a missing target resource; 409 for duplicate categories and deletion of a referenced category.
- Catch database constraint errors even when a pre-check exists. Do not leak raw database errors.
- Standard error response: { statusCode, error, message }, with message a string or string array for validation. Document examples in Swagger.
- DELETE succeeds with 204 and no body; POST with 201; GET/PATCH with 200.
- Add indexes justified by category lookups and date filtering. Explain query plans simply; do not add speculative indexes.

## 15. Claude Code configuration and hooks (Phase 0)
Create .claude/settings.json and scripts/hooks/*.mjs in Phase 0, after installing local Prettier. These files do not already exist merely because this plan describes them.

1. PostToolUse formatting hook: match the installed Claude Code file edit/write tools; read hook JSON from stdin and format only supported modified JS/TS files inside the repository.
2. PreToolUse safeguard: cover the shell tools actually available on the user's Windows setup. Deny recognizable high-risk operations such as force pushes, hard resets, broad recursive deletion, database reset/drop and Compose volume deletion.
3. Use portable Node scripts, quoted paths, and shell-free argument arrays when spawning child processes. Never interpolate hook input into shell commands.
4. Formatting must use the locally installed formatter without downloading packages. Respect ignore files and skip generated/build/vendor files and paths outside the repository.
5. Test formatting with an intentionally unformatted fixture. Test missing paths, spaces in paths, unsupported files, and out-of-root paths.
6. Test safeguard decisions with synthetic hook payloads only: ordinary read/test commands pass and dangerous sample commands are denied. Never execute destructive examples.
7. Check current official schemas, tool names and event output semantics before configuring. Document how to activate/reload and inspect hooks in the installed version. Test actual lifecycle triggering locally when possible; distinguish script tests from real Claude event tests.
8. Report errors visibly. Keep formatting failures diagnosable; safety-hook parse failures must not silently permit commands.
9. Hooks are an extra safeguard, not a general shell security boundary. Keep Claude permissions enabled; do not auto-approve commands or use permission bypass.
10. Do not run the full test suite after each edit. Do not add Stop hooks, MCP servers, subagents, plugins or custom skills in MVP without a concrete need.

CLAUDE.md contains instructions, plan.md contains the roadmap, and settings.json contains executable automation configuration. Neither Markdown file enforces permissions by itself.

## 16. Professional development workflow
- For multi-file work, use Claude Code Plan Mode supported by the installed version. Inspect first; explain approach, affected files, dependencies and acceptance criteria. Wait for the developer to approve that plan before implementing.
- Request approval for new dependencies once per proposed batch; explain their purpose. Then finish the approved scope without repeated routine confirmations.
- Work on a feature branch; inspect git status first and preserve existing user changes. Never discard work to get a clean tree.
- Before commit: review git diff and staged files, run applicable checks, summarize risks and propose a Conventional Commit message. Keep commit, push, merge and deployment separately authorized.
- Keep .env, test credentials, database volumes, dumps and personal financial records out of Git. Commit lockfile, migration SQL, fixtures containing synthetic data and .env.example placeholders.
- Use normal NestJS modules/controllers/services with PrismaService. Do not introduce repositories, CQRS or generic base services merely to imitate enterprise architecture.
- Maintain docs/progress.md with phase status, implemented scope, exact verification commands/results, blockers, manual checks and next task. Only mark complete when acceptance criteria are met.
- ADRs record meaningful decisions, alternatives and tradeoffs. Do not create one for every component.
- Add scoped .claude/rules files or custom skills only when existing instructions become unwieldy or an actual workflow repeats. Do not scaffold empty configuration for future possibilities.
- Repository files and Git are the shared source of truth; private auto-memory is supplementary.
- At the end of each phase, explain the request flow, key concepts, one production tradeoff, and a small exercise the learner can do.

## 17. Additional verification and operational criteria
- Phase 0: Prettier check and hook script fixtures pass; document prerequisites (Node/npm, Git, Docker Desktop with Compose, chosen SQL GUI). Record runtime hook verification as pending if Claude Code is unavailable.
- Phase 1: environment validation fails clearly for invalid settings; CORS permits the configured frontend origin; no wildcard production assumptions. Use server env files and VITE_API_BASE_URL for the browser; no secrets in VITE_ variables.
- Phase 2: use the official PostgreSQL image with a pinned compatible version; do not build a custom database image. Explain host 127.0.0.1 versus Compose service-name networking. Apply migrations to an empty database and check seed repeatability.
- Development seed inserts synthetic fixtures without deleting existing records; repeated runs must not duplicate fixtures. Test fixtures are managed separately.
- Phase 3/4: cover duplicate categories, referenced-category deletion, merged PATCH validation, empty updates, pagination boundaries, invalid calendar dates and decimal boundaries.
- Phase 5: cover empty months, month-boundary dates, multiple types/categories, negative net and decimal precision (for example 0.10 + 0.20 = 0.30).
- Phase 6: invalidate/refetch affected lists and summary after mutations; retain filters; prevent duplicate submit; show server validation failures; test key forms and loading/error states.
- Phase 7: CI runs on pull requests and main pushes with minimal permissions, a committed lockfile, compatible pinned tool versions, Postgres health checks, migrations applied to an isolated test DB and all established quality gates.
- Introduce tests and CI incrementally in their feature phases; Phase 7 completes the checks rather than delaying all testing to the end.
- Test DB must be separate from development DB. Require an explicit test environment and verify the target is the configured disposable test DB before cleanup. Never truncate a DB from an unchecked DATABASE_URL.
- Use parameterized SQL for learning queries and any raw Prisma queries. No unsafe SQL concatenation.
- Keep local API/database exposure limited to development. Public deployment and real financial data require a separate authentication, authorization and security phase.
- Production-style here means good engineering practices; the unauthenticated local MVP is not ready for public hosting.

## 18. Updated first prompt for Claude Code
Read CLAUDE.md and plan.md. Start Phase 0 only.
Inspect the existing folder and Git state first.
In Plan Mode, explain the proposed files, dependencies, standards and hook design.
Wait for my approval of the implementation plan.
Then implement only the approved Phase 0 scope, including minimal hooks after Prettier exists.
Run applicable checks and distinguish hook script tests from real event verification.
Update docs/progress.md and explain what I should learn.
Do not proceed to Phase 1, commit, push or deploy without my instruction.

## References for version-specific Claude setup
- Memory and CLAUDE.md: https://code.claude.com/docs/en/memory
- Hooks: https://code.claude.com/docs/en/hooks
- Permissions/settings: https://code.claude.com/docs/en/settings
Verify these against the installed Claude Code version during setup.


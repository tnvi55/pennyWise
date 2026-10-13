# CLAUDE.md — PennyWise

## Mission and scope
Build a learning-first personal Expense Tracker using React, Node.js, NestJS, PostgreSQL and Prisma with strict TypeScript. Follow plan.md and work only on the requested phase. MVP is single-user, local, INR-only and unauthenticated. Keep the implementation understandable.

## Start every session
- Read HANDOFF.md first, then plan.md, docs/progress.md, docs/parking-lot.md and relevant architecture/API docs.
- Inspect Git status and existing code. Preserve user changes.
- Summarize current phase, verified progress and next task. Do not treat planned work as completed.
- For multi-file work use the installed Claude Code Plan Mode: explain the approach, file changes, dependencies and acceptance criteria, then wait for approval before implementation. Save each approved plan unchanged to docs/plans/ (see its README).
- Once a scope is approved, finish its routine edits and checks without repeatedly asking. Stop at the phase boundary.

## Architecture and code
- React/Vite frontend; NestJS modules, controllers, services, DTOs and DI; shared PrismaService.
- Controllers handle HTTP, DTOs validate inputs, services enforce business rules, Prisma accesses PostgreSQL.
- Prefer idiomatic code over generic repositories, base classes, CQRS, microservices or speculative abstractions.
- Strict types; avoid unexplained any and unsafe assertions. Verify external data at runtime.
- Choose compatible stable dependencies using official docs; explain and obtain approval for a new dependency batch. Commit the lockfile.
- Configure environment validation, global request validation, explicit CORS origin and accurate OpenAPI request/response documentation.
- Use accessible forms and clear loading, empty, success and error states. Keep browser API requests typed.

## Domain rules
- Follow the exact contracts in plan.md section 14 and docs/api-design.md.
- Money: positive decimal-string inputs, PostgreSQL Decimal(12,2), fixed two-decimal output strings. Never compute financial totals with JS floating point.
- Dates: valid YYYY-MM-DD calendar values, PostgreSQL DATE and explicit UTC boundary conversion where needed. No expense-date timezone drift.
- Category type is immutable; category name/type pair is unique; referenced categories cannot be deleted.
- On transaction PATCH validate the merged record and category/type relationship. Reject empty updates and unknown fields.
- Use bounded pagination, stable sorting, correct HTTP codes and documented errors. Do not expose database internals.

## Database and Docker
- Use official PostgreSQL image via Docker Compose; no custom image required.
- Named persistent volume, health check, environment-based credentials and localhost-bound published port.
- Do not dockerize API/web in MVP unless requested.
- Explain image/container/volume/Compose and document Beekeeper Studio or pgAdmin connection to the same DB Prisma uses.
- Commit versioned migrations; use migration deploy for CI. Do not substitute db push for migration history.
- Use parameterized queries. Map unique/foreign-key constraint failures to documented errors.
- Keep seed data synthetic and repeatable without deleting user records.
- Keep test DB isolated; verify the disposable test target before cleanup.

## Claude hooks and permissions
- Phase 0 creates .claude/settings.json and portable Node hook scripts after local Prettier is installed.
- PostToolUse formats supported changed JS/TS files within the repo using local Prettier.
- PreToolUse denies recognizable destructive shell operations. Cover actual tools on the user's Windows setup and verify current official input/output schemas.
- Read JSON stdin; validate paths; avoid shell interpolation, network installs and formatting generated/vendor files.
- Test hook scripts with safe fixtures and synthetic payloads; separately report actual Claude lifecycle verification.
- Hooks supplement permission settings; they are not a complete shell security boundary. Never bypass permissions or configure automatic blanket approvals.
- No full-suite-after-every-edit or Stop hook in MVP.
- Add rules, skills, MCP, plugins, worktrees or subagents only for a concrete justified need.

## Verification
- Add meaningful service tests and real-Postgres API e2e tests with each feature. Use frontend behavior tests for key forms and API states.
- Cover success, invalid input, missing targets, conflicts, category/type mismatch, merged PATCH, decimal/date boundaries, filtering and summaries.
- Run relevant format/lint/typecheck/tests/build commands that actually exist. Add CI checks incrementally.
- Report exact commands and outcomes, failures and checks not run. Never claim passing results from inspection or mocked database tests alone.
- Fix failures within approved scope; explain unrelated blockers. Never weaken checks to produce green output.

## Git, safety and authorization
- Use a feature branch; keep changes focused; inspect diffs and staged files before proposing a commit.
- Do not commit, push, merge, deploy, reset databases, delete volumes or discard user work without explicit authorization for that action.
- Do not execute destructive commands to demonstrate safeguards.
- Keep .env, credentials, dumps, volumes and personal financial data out of Git; commit only placeholder env examples and synthetic fixtures.
- Frontend VITE_ variables are public; never put secrets in them.
- If requirements conflict or a consequential decision is ambiguous, explain it and ask. Do not silently expand scope.

## Documentation and teaching
- Maintain docs/progress.md: phase status, completed scope, exact checks/results, pending manual verification, blockers and next task.
- Keep HANDOFF.md current (one page) and put deferred work and ideas in docs/parking-lot.md, not in code comments.
- Update requirements, architecture and API docs when behavior changes. Record significant decisions and tradeoffs in ADRs.
- Keep CLAUDE.md concise; create scoped rules only when needed. Repository docs and Git are the shared source of truth.
- Explain each major concept in simple words: what it does, why needed and how it connects to the request flow.
- End each phase with changed-file summary, verification results, learning points, one small exercise and proposed next step/commit message.
- Do not automatically continue to the next phase.

## Official Claude references
https://code.claude.com/docs/en/memory
https://code.claude.com/docs/en/hooks
https://code.claude.com/docs/en/settings


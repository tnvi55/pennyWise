# Security notes

PennyWise is a **local, single-user, unauthenticated** learning project. It is not ready for public hosting. Deploying it, or storing real financial data on a shared machine, would first need a separate authentication, authorization and security phase (plan.md section 17).

## What protects the local setup

| Area             | Measure                                                                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network exposure | The API listens on `127.0.0.1` only. PostgreSQL is published on `127.0.0.1` only (`compose.yaml`). Vite serves on `localhost`.                                                                                                              |
| Browser access   | CORS allows exactly one origin (`CORS_ORIGIN`, default `http://localhost:5173`); other origins get no `Access-Control-Allow-Origin` header.                                                                                                 |
| Secrets          | `.env` is gitignored, and only placeholder values are committed (`.env.example`). The full git history was scanned in Phase 7. Startup validation never prints `DATABASE_URL`. `VITE_*` variables are public by design and hold no secrets. |
| Input            | A global `ValidationPipe` rejects unknown fields. DTOs validate every value (money as decimal strings, real calendar dates, UUIDs, enums, lengths).                                                                                         |
| SQL              | Prisma queries and the summary's `$queryRaw` tagged templates send values as bound parameters; no SQL is built by string concatenation.                                                                                                     |
| Errors           | Responses use `{ statusCode, error, message }`. Unexpected errors become a generic 500, and details are logged on the server only. Database errors are mapped, never returned.                                                              |
| Headers          | `X-Powered-By` is disabled.                                                                                                                                                                                                                 |
| Tests            | e2e tests only touch a database whose name ends in `_test` on localhost, and never the `DATABASE_URL` database (`apps/api/test/test-database.ts`).                                                                                          |
| Claude Code      | `.claude/settings.json` denies reading `.env`. A PreToolUse hook blocks recognizable destructive shell commands. It is a safety net, not a security boundary.                                                                               |
| CI               | `permissions: contents: read`; the CI database has throwaway credentials and exists only inside the run; `npm audit --omit=dev --audit-level=critical` fails the build on critical advisories.                                              |

## Known advisories (as of 2026-10-13)

`npm audit --omit=dev` reports **4 high-severity** findings, all inside the **Prisma CLI** (`prisma@7.10.0`):

- `deepmerge-ts@7.1.5` (via `@prisma/config`): stack exhaustion when merging recursive object graphs.
- `mysql2@3.15.3`: MySQL-protocol issues; this project uses PostgreSQL only and never loads it.

Why they are not fixed yet:

- The CLI is a dev dependency, used only by `migrate`, `generate` and `db seed` with trusted local input. npm counts it as possibly needed in production only because `@prisma/client` lists it as an optional peer dependency.
- The running API loads only the generated client and `@prisma/adapter-pg`, never the CLI.
- The only offered fix (`npm audit fix --force`) downgrades to Prisma 6, a breaking change. Overriding the CLI's exactly pinned `mysql2` could break it.
- **Action:** upgrade when a stable Prisma release ships fixed versions. Prisma 8 is currently a release candidate. CI blocks anything rated critical.

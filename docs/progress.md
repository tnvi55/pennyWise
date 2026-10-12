# Progress

| Phase | Name                     | Status                                 |
| ----- | ------------------------ | -------------------------------------- |
| 0     | Repository and standards | Complete (commit 5e97bc8, CI green)    |
| 1     | Backend skeleton         | Implemented, verified; awaiting commit |
| 2     | PostgreSQL + Prisma      | Not started                            |
| 3     | Categories API           | Not started                            |
| 4     | Transactions API         | Not started                            |
| 5     | Summary API              | Not started                            |
| 6     | React frontend           | Not started                            |
| 7     | Production-style quality | Not started                            |

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

Branch: `feature/backend-setup` (from `main`). Not committed yet.

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
- CI on GitHub runs only after a push or PR, which needs your authorization.

### Known limitations

- Express's default HTML 404 for paths outside `/api/v1` is accepted; every API route lives under the prefix.
- Responses still include the `X-Powered-By: Express` header. It can be removed in Phase 7.
- The 20 moderate `npm audit` findings are in dev-only tooling.

### Next task

1. Review the Phase 1 diff and authorize a commit. Proposed message: `feat(api): add NestJS backend skeleton with health endpoint, env validation and swagger`.
2. Then Phase 2 (PostgreSQL + Prisma), when you instruct.

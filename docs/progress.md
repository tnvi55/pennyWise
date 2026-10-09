# Progress

| Phase | Name                     | Status                                                  |
| ----- | ------------------------ | ------------------------------------------------------- |
| 0     | Repository and standards | Implemented, awaiting review/commit (not yet committed) |
| 1     | Backend skeleton         | Not started                                             |
| 2     | PostgreSQL + Prisma      | Not started                                             |
| 3     | Categories API           | Not started                                             |
| 4     | Transactions API         | Not started                                             |
| 5     | Summary API              | Not started                                             |
| 6     | React frontend           | Not started                                             |
| 7     | Production-style quality | Not started                                             |

## Phase 0: repository and standards

Branch: `chore/phase-0-setup` (Git initialized 2026-10-09, no commits yet).

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
- CI has not run yet. It needs a GitHub remote and a push, which require your authorization.
- Git identity checked: global `user.name=Tanvi`, `user.email=tanvi.jain@fiftyfivetech.io`. No remote is configured yet, so commits stay local until one is added.

### Known limitations

- The guard matches command text: it is a safety net, not a security boundary.
  - It can be bypassed by obfuscation.
  - It blocks harmless text that mentions a dangerous command, such as `echo` or `grep` patterns.
- The format hook only handles JS/TS files. JSON, Markdown and YAML are checked by `format:check` and CI instead.

### Next task

1. Review the Phase 0 changes and authorize a commit. Proposed message: `chore: set up repository standards, prettier, claude hooks and ci`.
2. Then Phase 1, backend skeleton, when you instruct.

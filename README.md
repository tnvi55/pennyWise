# PennyWise

A learning-first, single-user personal expense tracker built with React, NestJS, PostgreSQL and Prisma in strict TypeScript. It is local only, unauthenticated and INR only.

> **Status:** Phase 0 (repository and standards). No application code yet. See [docs/progress.md](docs/progress.md).

## Prerequisites

| Tool                            | Version                 | Needed from |
| ------------------------------- | ----------------------- | ----------- |
| Node.js                         | 22.12+ (see `.nvmrc`)   | Phase 0     |
| npm                             | 10+ (bundled with Node) | Phase 0     |
| Git                             | any recent              | Phase 0     |
| Docker Desktop with Compose v2+ | recent stable           | Phase 2     |
| Beekeeper Studio **or** pgAdmin | recent stable           | Phase 2     |

## Setup

```bash
npm ci                  # install exact versions from package-lock.json
npm run format:check    # verify formatting
npm run test:hooks      # test the Claude Code hook scripts
```

Copy `.env.example` to `.env` when later phases need it. Never commit `.env`.

## Scripts

| Script                 | What it does                                                  |
| ---------------------- | ------------------------------------------------------------- |
| `npm run format`       | Format the repository with Prettier                           |
| `npm run format:check` | Fail if any file is not formatted (used in CI)                |
| `npm run test:hooks`   | Run Node's built-in test runner on `scripts/hooks/*.test.mjs` |

Lint, typecheck, test and build scripts will be added when the apps exist.

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
apps/          # api (NestJS) and web (React) — created in Phases 1 and 6
docs/          # requirements, architecture, API design, progress, ADRs
scripts/hooks/ # Claude Code hook scripts and tests
```

## Documentation

- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [API design](docs/api-design.md)
- [Progress](docs/progress.md)
- [ADR 0001: monorepo and architecture](docs/adr/0001-monorepo-and-architecture.md)
- [Implementation plan](plan.md) and [Claude instructions](CLAUDE.md)

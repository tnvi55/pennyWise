# ADR 0001: npm workspaces monorepo and layered NestJS architecture

- Status: Accepted
- Date: 2026-10-09

## Context

PennyWise has a NestJS API and a React web app, developed by one learner. Both need consistent formatting, one CI pipeline, and pinned dependency versions. The project prioritizes understanding over tooling.

## Decision

- **One repository** using plain **npm workspaces** (`"workspaces": ["apps/*"]`), with a single root `package-lock.json`.
- Shared tooling (Prettier, CI, Claude Code hooks) lives at the root. Each app owns its own TypeScript, ESLint and test configuration.
- The backend uses the standard NestJS layers: module → controller → service → a shared `PrismaService`. There is no generic repository pattern, CQRS or microservices.

## Alternatives considered

| Option                             | Why not (for now)                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Nx / Turborepo                     | Task caching and generators help large repos but add concepts and configuration that hide what npm is doing.     |
| pnpm workspaces                    | Faster and stricter, but adds a second package manager to learn. npm comes with Node.                            |
| Two separate repositories          | Changes to the API contract would be split across repos, PRs and CI pipelines.                                   |
| Repository/CQRS layers over Prisma | Prisma already provides a typed data-access API, so another layer would add indirection without a concrete need. |

## Consequences

- One `npm ci` installs everything, and one lockfile is committed.
- Workspace scripts run with `npm run <script> -w apps/api` or `--workspaces`.
- If build times grow, Turborepo can be added later without restructuring the folders.

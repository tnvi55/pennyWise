# ADR 0003: Prisma 7 with the pg driver adapter, and PostgreSQL 18 in Docker Compose

- Status: Accepted
- Date: 2026-10-12

## Context

Phase 2 adds the database. The plan fixes PostgreSQL + Prisma, with versioned migrations and the official PostgreSQL image. Within that, several version-specific choices had to be made.

## Decision

- **Prisma ORM 7.10.0** (`prisma`, `@prisma/client`, `@prisma/adapter-pg`), pinned exactly. npm's `latest` tag currently points at `8.0.0-rc.22`, a release candidate, so it is not used.
- **The `prisma-client` generator** writes a TypeScript client to `apps/api/src/generated/prisma`, with `moduleFormat = "cjs"` because the Nest build is CommonJS.
  - The output is gitignored and rebuilt by `prisma generate`, which runs as the API's `postinstall` script.
  - Jest maps the client's `./x.js` imports to `./x.ts` (`moduleNameMapper`).
- **The `pg` driver adapter** (`PrismaPg`) is how Prisma 7 connects. Queries run through the standard `pg` driver; there is no separate query-engine binary.
- **`prisma.config.ts`** holds the schema path, migrations path, seed command and connection URL.
  - Prisma 7 no longer loads `.env` itself. The config loads it with Node's built-in `process.loadEnvFile()`, in the same order as the API (`apps/api/.env`, then the root `.env`), and only if the file exists. No `dotenv` dependency is needed.
- **`postgres:18.6`**, the official Debian-based image, pinned to a minor version.
  - The named volume is mounted at `/var/lib/postgresql`, because PostgreSQL 18 images moved the data directory below it.
  - Debian is used rather than Alpine for standard glibc locale and collation behaviour.
- **Snake_case SQL names** (`@@map`/`@map`) with camelCase TypeScript fields, so hand-written SQL in a GUI reads naturally.
- **Constraints Prisma's schema language cannot express** are added by hand to the migration SQL: `CHECK (amount > 0)` and `CHECK (btrim(name) <> '')`.
- **The seed** (`tsx prisma/seed.ts`) upserts on natural or fixed keys with `update: {}`. It is repeatable and never deletes or overwrites rows.

## Alternatives considered

| Option                                                  | Why not (for now)                                                                             |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Prisma 6 (`prisma-client-js`, client in `node_modules`) | Superseded major version; Prisma 7 is the documented setup for new projects.                  |
| Prisma 8 release candidate                              | Not a stable release.                                                                         |
| `dotenv` in `prisma.config.ts`                          | Node 24 has a built-in `.env` loader, so the extra dependency isn't needed.                   |
| `postgres:18.6-alpine`                                  | Smaller, but musl locales differ from glibc; size doesn't matter for local development.       |
| `prisma db push`                                        | No migration history; the project rules require versioned migrations.                         |
| Prisma Studio                                           | The plan asks for Beekeeper Studio or pgAdmin, so learners see plain SQL and the real tables. |

## Consequences

- After cloning, `npm ci` generates the client. Changing `schema.prisma` needs `npm run db:migrate`, which also regenerates it.
- The API starts without a database: Prisma connects on the first query. Health is still a liveness check.
- Hand-added CHECK constraints live only in the migration SQL. Future migrations must not drop them by accident; review generated SQL before applying it.

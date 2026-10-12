# ADR 0002: Node 24 and Jest with ESM-only NestJS packages

- Status: Accepted
- Date: 2026-10-09

## Context

NestJS 12 publishes its packages (`@nestjs/core`, `@nestjs/testing`, `@nestjs/config`, …) as ESM only (`"type": "module"`). The API itself compiles to CommonJS. Node can `require()` ESM synchronously since 22.12, so the built server runs fine.

Jest 30 runs tests in its own module system built on `node:vm`. It can load ESM-only packages from CommonJS tests only through `vm.SourceTextModule`, and Node exposes that class only when started with `--experimental-vm-modules`. Jest's native require(ESM) path also needs `SourceTextModule.prototype.hasAsyncGraph`, which was added in Node 24.9.

Verified on Node 24.21.0: without the flag, `typeof vm.SourceTextModule` is `undefined` and every spec that imports `@nestjs/testing` fails with `ERR_REQUIRE_ESM`. With the flag, all unit and e2e tests pass.

## Decision

- Require **Node 24.9+** (`.nvmrc` = `24`, `engines.node` = `>=24.9.0`) and npm 11 (`packageManager` = `npm@11.19.0`).
- Run Jest as `node --experimental-vm-modules ../../node_modules/jest/bin/jest.js …` in `apps/api` scripts. This form works the same in Windows `cmd` and POSIX shells.

## Alternatives considered

| Option                                                 | Why not (for now)                                                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Stay on Node 22 and transform `node_modules/@nestjs/*` | Every Nest package would be compiled through ts-jest/babel on each run: slow, and fragile config.              |
| `NODE_OPTIONS=--experimental-vm-modules jest`          | The inline env syntax differs between `cmd` and POSIX shells; fixing that needs `cross-env`, a new dependency. |
| Vitest instead of Jest                                 | A valid option, but a larger change than the problem needs; Nest docs and examples use Jest.                   |
| Downgrade to NestJS 11 (CommonJS)                      | Starts the project on a superseded major version.                                                              |

## Consequences

- Test output prints one `ExperimentalWarning: VM Modules is an experimental feature`. It is expected and harmless.
- The scripts rely on npm workspaces hoisting `jest` to the root `node_modules`. If that changes, the path must be updated.
- When Jest supports require(ESM) without the flag, the scripts can return to plain `jest`.

# EventPulse

Developer-facing payment-event simulation and observability platform.

> Full setup instructions (infrastructure, migrations, Kafka topics, API examples) land in Milestone 7. What follows reflects only what exists today, through Milestone 3.

## Repository structure

```text
eventpulse/
├── apps/
│   ├── api/              # Express API (Milestone 4)
│   ├── outbox-relay/     # Outbox → Kafka relay (Milestone 5)
│   └── event-consumer/   # Kafka consumer (Milestone 6)
├── packages/
│   ├── shared/           # Event envelope types, Zod schemas, state machine, ledger math
│   ├── database/         # Prisma schema, migrations, client, wire<->DB enum mappers
│   └── config/           # Shared env/config loading
├── tests/
│   └── integration/      # Tests that require a live PostgreSQL (see below)
├── docker-compose.yml    # Local PostgreSQL (Kafka added in Milestone 5)
├── tsconfig.base.json    # Shared strict TypeScript compiler options
├── eslint.config.js      # Flat ESLint config (typescript-eslint + Prettier)
└── vitest.config.ts      # Unit test runner config (globs all workspaces)
```

## Prerequisites

- Node.js >= 20.11 (developed against Node 24)
- npm >= 10
- Docker (for local PostgreSQL)

## Install

```bash
npm install
cp .env.example .env
```

This installs all workspaces (`apps/*`, `packages/*`) and links `@eventpulse/*` packages to each other via npm workspaces.

## Database

```bash
docker compose up -d postgres
npm run migrate:dev --workspace=packages/database    # first run: creates the DB and applies migrations
npm run generate --workspace=packages/database        # regenerate the Prisma client after schema changes
```

`packages/database/prisma/migrations/*/migration.sql` includes a few hand-written `CHECK` constraints
(cumulative refunds can't exceed the captured amount, authorized/captured amounts can't exceed their
predecessor, amounts are positive) that the Prisma schema language can't express directly — see the
comment block at the end of the migration file.

## Available commands (root)

| Command                    | What it does                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `npm run build`            | Builds all packages/apps in dependency order via TypeScript project references (`tsc -b`)   |
| `npm run typecheck`        | Alias for `build` — project references require emit, so a successful build is the typecheck |
| `npm run lint`             | Lints the whole repo with ESLint                                                            |
| `npm run lint:fix`         | Lints and auto-fixes                                                                        |
| `npm run format`           | Checks formatting with Prettier                                                             |
| `npm run format:fix`       | Formats the repo with Prettier                                                              |
| `npm run test`             | Runs unit tests only (no infrastructure needed)                                             |
| `npm run test:integration` | Runs tests under `tests/integration/` against the real PostgreSQL started above             |

## Current state

Domain logic that doesn't need a database — the event envelope schemas, the payment state machine
(including the out-of-order vs. invalid-transition distinction and multi-partial-refund handling), and
the double-entry ledger math — lives in `packages/shared` and is fully unit tested. `packages/database`
has a finalized Prisma schema, a generated client, and a drafted initial migration. API routes, the
outbox relay, and the Kafka consumer don't exist yet (Milestones 4-6) — each app still exports a
placeholder to prove the workspace graph builds end-to-end.

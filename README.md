# EventPulse

Developer-facing payment-event simulation and observability platform.

> Full setup instructions (infrastructure, migrations, Kafka topics, API examples) land in Milestone 7. What follows reflects only what exists today, through Milestone 4.

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

## Running the API

```bash
npm run dev --workspace=apps/api
```

```bash
curl -X POST http://localhost:3000/api/v1/payment-events \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "11111111-1111-1111-1111-111111111111",
    "eventType": "payment.initiated",
    "schemaVersion": 1,
    "occurredAt": "2026-01-01T00:00:00.000Z",
    "merchantId": "22222222-2222-2222-2222-222222222222",
    "paymentId": "33333333-3333-3333-3333-333333333333",
    "payload": { "amountMinor": 5000, "currency": "USD" }
  }'

curl http://localhost:3000/api/v1/events/11111111-1111-1111-1111-111111111111
curl http://localhost:3000/api/v1/payments/33333333-3333-3333-3333-333333333333
curl http://localhost:3000/api/v1/health
```

The API accepts the event and persists it with its outbox record atomically, but does **not** itself
advance `Payment.status` beyond `INITIATED` for anything but the genesis `payment.initiated` event —
state transitions and ledger postings are exclusively the event-consumer's job (Milestone 6), since they
require the payment's true current state at Kafka-delivery time, not HTTP-request time. See the comment
block at the top of `apps/api/src/routes/payment-events.ts`.

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
has a finalized Prisma schema, a generated client, and a drafted initial migration. The API
(`apps/api`) implements all four Stage 1 endpoints with transactional accept-and-outbox persistence,
unit tested against a fake Prisma client; its live-database behavior (atomic commit, idempotent replay,
the 503-when-down path) is covered by `tests/integration/api.integration.test.ts` but has not yet been
run against a real PostgreSQL in this environment — see that file's header for how to run it. The
outbox relay and the Kafka consumer don't exist yet (Milestones 5-6) — each of those two apps still
exports a placeholder to prove the workspace graph builds end-to-end.

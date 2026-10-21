# EventPulse

Developer-facing payment-event simulation and observability platform.

> Full setup instructions (infrastructure, migrations, Kafka topics, API examples) land in Milestone 7. What follows reflects only what exists today: the monorepo scaffold from Milestone 2.

## Repository structure

```text
eventpulse/
├── apps/
│   ├── api/              # Express API (Milestone 4)
│   ├── outbox-relay/     # Outbox → Kafka relay (Milestone 5)
│   └── event-consumer/   # Kafka consumer (Milestone 6)
├── packages/
│   ├── shared/           # Event envelope types & Zod schemas (Milestone 3)
│   ├── database/         # Prisma schema & client (Milestone 3)
│   └── config/           # Shared env/config loading
├── tsconfig.base.json    # Shared strict TypeScript compiler options
├── eslint.config.js      # Flat ESLint config (typescript-eslint + Prettier)
└── vitest.config.ts      # Test runner config (globs all workspaces)
```

## Prerequisites

- Node.js >= 20.11 (developed against Node 24)
- npm >= 10

## Install

```bash
npm install
```

This installs all workspaces (`apps/*`, `packages/*`) and links `@eventpulse/*` packages to each other via npm workspaces.

## Available commands (root)

| Command              | What it does                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `npm run build`      | Builds all packages/apps in dependency order via TypeScript project references (`tsc -b`)   |
| `npm run typecheck`  | Alias for `build` — project references require emit, so a successful build is the typecheck |
| `npm run lint`       | Lints the whole repo with ESLint                                                            |
| `npm run lint:fix`   | Lints and auto-fixes                                                                        |
| `npm run format`     | Checks formatting with Prettier                                                             |
| `npm run format:fix` | Formats the repo with Prettier                                                              |
| `npm run test`       | Runs all Vitest suites across every workspace                                               |

## Current state

No database schema, API routes, relay, or consumer logic exist yet — each app/package currently exports a placeholder to prove the workspace graph builds, lints, and tests correctly end-to-end. That logic is added starting with Milestone 3.

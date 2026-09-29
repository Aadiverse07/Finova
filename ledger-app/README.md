# Ledger

Double-entry accounting application foundation, with an optional QuikIT authentication adapter. Next.js App Router, TypeScript strict, Prisma/PostgreSQL, and mock-first configuration.

## Getting started

1. `cp .env.example .env`
2. `pnpm install`
3. `pnpm dev`
4. For PostgreSQL: `pnpm db:up`, then `pnpm db:migrate`

`DATA_SOURCE` supports `mock` and `prisma`. See `docs/ARCHITECTURE.md`.

## QuikIT integration

See [`docs/integration/QUIKIT_INTEGRATION.md`](docs/integration/QUIKIT_INTEGRATION.md). QuikIT authentication is opt-in; configure the documented auth service URL and shared `INTERNAL_SECRET` before enabling it. The supplied QuikIT materials are documentation only, so shared-package, shared-database, UI, deployment, and live SSO integration remain unverified.

# Architecture

Route handlers are transport adapters; accounting rules belong in `src/lib/ledger`. Monetary values are integer paise at the application boundary and BigInt in PostgreSQL. Journal entries are append-only; corrections are represented by reversal entries.

## Request flow

`route.ts` -> `withOrgAuth` (verify session via the QuikIT auth service, resolve `orgId`) -> Zod validation -> repository (`orgId` first argument, in every query) -> `writeAuditLog` for mutations -> `{ success, data }` envelope. Repository implementations are selected by `DATA_SOURCE` (`mock` | `prisma`).

## Tenancy

Tenant scoping is manual: there is no Postgres row-level security, so the `orgId` filter in each repository query is the only boundary. All models carry an indexed `orgId`; uniqueness (account code, entry number, invoice number) is per org.

## Status

Implemented: app shell, org-scoped schema and migration, auth adapter and wrappers, envelope/pagination/audit/rate-limit helpers, health endpoint, accounts API (list/create), validated journal endpoint contract, money helpers, ledger validation, tests. Remaining: journal posting workflow (hash chain, per-org counters, period lock), invoices, expenses, reports, UI screens, seed data.

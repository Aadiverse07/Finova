# QuikIT integration status

Finova (`ledger-app`) is aligned to the QuikIT platform docs (handbook `11-app-developer-integration-handbook.md`,
`03-api-patterns.md`, `04-db-patterns.md`, `12-auth-service-integration-response.md`,
`13-app-ports-and-env.md`, `PRODUCTION_ENV_VARS.md`, `INFRA_login_redirect_and_cookie_fix.md`).

The QuikIT monorepo (`@quikit/*` packages, `apps/*`) and a live environment were **not** supplied, so anything
that depends on them is implemented as a small local stand-in with the same call shape, and is listed under
"Replace at integration". Nothing here has been run against a real QuikIT auth service or database.

## Done (in this package)

| Area | Doc rule | Where |
|---|---|---|
| Auth contract | `GET /api/verify-token` with `x-internal-secret`; `{valid:false}` = 401; no `activeOrgId` = 403; `orgActive:false` = 403; auth-service 403 (bad secret) = 503 | `src/lib/quikit-auth.ts` |
| Route wrapper | Every route wrapped in `withOrgAuth` / `requireAdmin`; handler gets `{ userId, orgId, orgRole, isSuperAdmin, email, actingAs, actingAgentId }`; unexpected throws become a generic 500 | `src/lib/api/withOrgAuth.ts` |
| Response envelope | `{ success: true, data }` / `{ success: false, error }`; POST create = 201; no raw arrays | `src/lib/api/response.ts` |
| Validation | Zod on every body and query string; unknown keys rejected (`.strict()`), so a client can never supply `orgId` | `src/lib/schemas/*` |
| Tenant scoping | `orgId` is the first argument of every repository method and in every query `where` | `src/lib/repo/*` |
| Pagination | Frozen shape `{ data, pagination: { page, limit, total, totalPages } }`, defaults 1 / 20, max 100 | `src/lib/api/pagination.ts` |
| Audit | Mutations call `writeAuditLog` (field names only, never values; never blocks the mutation) | `src/lib/api/auditLog.ts` |
| Rate limiting | Applied to `POST /api/accounts` | `src/lib/api/rateLimit.ts` |
| Health | `GET /api/health` -> `{ ok, version, db }` (public, un-enveloped) | `src/app/api/health/route.ts` |
| Login route | `/login` (not `/auth/login`); redirects to the central auth host, no local credentials UI | `src/app/login/page.tsx` |
| Middleware | Cookie check -> central login, using the public origin (never the bind address) | `src/middleware.ts` |
| Providers | `QueryClientProvider -> ThemeProvider` (SessionProvider goes outermost at integration) | `src/app/providers.tsx` |
| Manifest | `appId`, `name`, `routePrefix`, `permissions`, `navigation` | `manifest.ts` |
| DB schema | `orgId` + index on every model, per-org uniqueness, `createdBy/updatedBy/createdAt/updatedAt` where the table is mutable, `directUrl` | `prisma/schema.prisma`, `prisma/migrations/20260930000000_org_scoping` |
| Env vars | Names per `13-app-ports-and-env.md`; `DATABASE_URL_DIRECT`, `NEXTAUTH_*`, `NEXT_PUBLIC_AUTH_URL`, `QUIKIT_URL`, `INTERNAL_SECRET`, `REDIS_URL`, ... | `.env.example`, `src/lib/env.ts` |
| Port / tooling | Dev port **3011** (next free after `_template` 3010), npm, `output: 'standalone'` for the GHCR image build | `package.json`, `next.config.mjs`, CI |
| Tests | Under `__tests__/` (unit, api). Every route has 401, cross-org, and happy-path coverage | `__tests__/**` |

Persistence status: `GET/POST /api/accounts` are fully implemented (mock in-memory or Prisma, selected by
`DATA_SOURCE`). `/api/journal` validates input but still returns 501 for writes and an empty page for reads;
the posting workflow (hash chain, per-org `entryNo` counter, period lock) is not built.

## Replace at integration (needs the real monorepo)

1. `src/lib/api/withOrgAuth.ts` + `src/lib/quikit-auth.ts` -> factories from `@quikit/auth` (`createGetTenantId`, `createRequireAdmin`).
2. `src/middleware.ts` -> `createMiddleware` from `@quikit/auth/middleware` (platform rule: no bespoke middleware).
3. `src/lib/api/pagination.ts`, `roles.ts` -> `@quikit/shared`. `rateLimit.ts` -> `@quikit/shared/rateLimit` (Redis-backed).
4. `src/lib/db.ts` -> `export { db } from "@quikit/database"`.
5. `src/lib/api/auditLog.ts` -> write to the shared `AuditLog` table (currently a structured log line).
6. Add `/auth-handoff` (cross-domain cookie bridge) and `SessionProvider` - both come from the shared auth package.
7. UI: replace local components with `@quikit/ui`, add `ThemeApplier` and `accent-*` classes.

## Needs the integration owner

- **Schema:** see [SCHEMA_CHANGE_REQUEST.md](./SCHEMA_CHANGE_REQUEST.md). Do not point this standalone schema at the shared database.
- **`manifest.ts`:** `permissions` is empty on purpose (strings must come from `@quikit/shared`); confirm `appId: "finova"`, `routePrefix: "/"`, and the port before sign-off. These are frozen afterwards.
- **Module registry:** no `moduleKey` gating yet; pick a top-level module prefix and register it.
- **OAuth client:** `QUIKIT_CLIENT_ID` / `QUIKIT_CLIENT_SECRET`, an `App` row (`baseUrl`), the production host, and the GKE ConfigMap/Secret.
- **Cluster-wide secrets** (`NEXTAUTH_SECRET`, `INTERNAL_SECRET`, `REDIS_URL`) must be byte-identical to every other app or SSO silently breaks.
- **Not done here by design:** Dockerfile and k8s manifests (owned by the integration team).

## Configuration

Copy `.env.example` to `.env.local`. To enable QuikIT auth locally set `QUIKIT_AUTH_ENABLED=true`, run the launcher
(`:3000`) and auth (`:3001`), and use the same `INTERNAL_SECRET` as the cluster. With it `false` (default), the
authenticated API routes answer 503 rather than serve unscoped data. Never commit real secrets.

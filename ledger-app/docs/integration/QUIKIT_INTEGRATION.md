# QuikIT integration readiness

This repository was adapted using the supplied QuikIT documentation only. The QuikIT monorepo/source code and a live environment were not supplied, so this is an integration adapter, not a verified installation inside QuikIT.

## Implemented in this package

- Added `src/lib/quikit-auth.ts`, a server-side adapter for the documented `GET /api/verify-token` contract.
- The adapter forwards the incoming Bearer authorization header and/or session cookie, sends `x-internal-secret`, and reads `userId`, `activeOrgId`, `email`, `orgRole`, and `isSuperAdmin` from the documented response.
- Account and journal API routes now require a validated QuikIT identity when `QUIKIT_AUTH_ENABLED=true`. They reject missing/invalid sessions and missing active organizations. They do not return unscoped business data.
- Standalone mode remains the default (`QUIKIT_AUTH_ENABLED=false`).

## Configuration

Set these server-side variables in the deployment environment:

- `QUIKIT_AUTH_ENABLED=true`
- `QUIKIT_AUTH_URL=http://localhost:3001` for local QuikIT auth, or `https://authn.quikit.ai` for the documented production host
- `INTERNAL_SECRET` to the actual shared secret configured in the QuikIT environment
- `NEXTAUTH_SECRET` and `NEXTAUTH_URL` according to the deployment's shared-session setup
- `QUIKIT_URL` to the launcher origin (documented local `http://localhost:3000`; production `https://apps.quikit.ai`)

Do not commit real secrets. Do not enable the adapter against an unrelated auth service.

## Important integration work still required

1. **Shared packages:** The QuikIT docs say apps use `@quikit/auth`, `@quikit/database`, `@quikit/ui`, and `@quikit/shared`. Those packages are not present in this standalone ZIP, so package imports and the canonical `withOrgAuth` wrapper cannot be wired or verified here.
2. **Database:** QuikIT requires org-scoped models and queries filtered by `orgId`, and its shared Prisma schema is centrally owned. This app currently has a standalone Prisma schema without `orgId` on accounting models. Before production integration, propose/add the accounting models in QuikIT's shared schema and scope every read/write by `orgId`; do not simply point the current schema at QuikIT's shared database.
3. **Persistence:** The account and journal route handlers are still placeholders; this change does not claim to implement accounting persistence.
4. **UI and deployment:** Shared UI imports, workspace configuration, app registration, production host, and deployment manifests require the actual monorepo or integration-owner confirmation.
5. **Verification:** Test against a real QuikIT auth service and organization, then add the required unauthenticated, cross-org, and happy-path route tests.

## Current behavior

With `QUIKIT_AUTH_ENABLED=false`, these routes retain the scaffold behavior (empty list / not-implemented writes). With it enabled, they require a valid QuikIT session and active organization. The current UI and accounting persistence remain foundation scaffolding, not a complete accounting product.

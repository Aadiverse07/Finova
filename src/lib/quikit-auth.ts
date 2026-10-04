import type { NextRequest } from 'next/server';

/**
 * Server-side adapter for the auth service's `GET /api/verify-token`
 * (docs/12-auth-service-integration-response.md §2).
 *
 * Contract recap:
 *  - Header `x-internal-secret: <INTERNAL_SECRET>` is required (wrong/missing -> 403).
 *  - Token comes from `Authorization: Bearer <jwt>` or the NextAuth session cookie
 *    (`next-auth.session-token`, `__Secure-next-auth.session-token` in production).
 *  - Success: 200 `{ valid: true, userId, email, activeOrgId, orgRole, isSuperAdmin, orgActive }`.
 *  - Any token rejection: 200 `{ valid: false }` (deliberately minimal).
 *  - `activeOrgId` is null when no org is selected; `orgRole` is null without a membership role.
 *  - `orgActive` is the live DB org-status check (suspended/archived org => false).
 */
export type QuikITIdentity = {
  userId: string;
  email?: string;
  orgId: string;
  orgRole: string | null;
  isSuperAdmin: boolean;
};

export type AuthFailure = {
  ok: false;
  status: 401 | 403 | 503;
  code:
    | 'QUIKIT_AUTH_DISABLED'
    | 'QUIKIT_AUTH_CONFIG_MISSING'
    | 'UNAUTHENTICATED'
    | 'INVALID_AUTH_CLAIMS'
    | 'ORG_REQUIRED'
    | 'ORG_INACTIVE'
    | 'AUTH_SERVICE_MISCONFIGURED'
    | 'AUTH_SERVICE_UNAVAILABLE';
  message: string;
};

export type AuthResult = { ok: true; identity: QuikITIdentity } | AuthFailure;

const fail = (status: AuthFailure['status'], code: AuthFailure['code'], message: string): AuthFailure => ({
  ok: false,
  status,
  code,
  message,
});

export async function getQuikITIdentity(request: NextRequest): Promise<AuthResult> {
  if (process.env.QUIKIT_AUTH_ENABLED !== 'true') {
    return fail(503, 'QUIKIT_AUTH_DISABLED', 'QuikIT authentication is not enabled.');
  }

  const authUrl = process.env.QUIKIT_AUTH_URL ?? process.env.NEXT_PUBLIC_AUTH_URL;
  const internalSecret = process.env.INTERNAL_SECRET;
  if (!authUrl || !internalSecret) {
    return fail(503, 'QUIKIT_AUTH_CONFIG_MISSING', 'QuikIT authentication is not configured.');
  }

  const authorization = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');
  if (!authorization && !cookie) {
    return fail(401, 'UNAUTHENTICATED', 'A QuikIT session is required.');
  }

  try {
    const headers = new Headers({ 'x-internal-secret': internalSecret });
    if (authorization) headers.set('authorization', authorization);
    if (cookie) headers.set('cookie', cookie);

    const response = await fetch(`${authUrl.replace(/\/$/, '')}/api/verify-token`, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    // 403 = our INTERNAL_SECRET is wrong/missing on the auth side: a deployment problem, not a user problem.
    if (response.status === 403) {
      return fail(503, 'AUTH_SERVICE_MISCONFIGURED', 'The QuikIT authentication service rejected this service.');
    }
    if (response.status >= 500) {
      return fail(503, 'AUTH_SERVICE_UNAVAILABLE', 'The QuikIT authentication service is unavailable.');
    }
    if (!response.ok) {
      return fail(401, 'UNAUTHENTICATED', 'QuikIT could not validate the session.');
    }

    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || (body as { valid?: unknown }).valid !== true) {
      return fail(401, 'UNAUTHENTICATED', 'The QuikIT session is invalid or expired.');
    }

    const claims = body as {
      userId?: unknown;
      activeOrgId?: unknown;
      email?: unknown;
      orgRole?: unknown;
      isSuperAdmin?: unknown;
      orgActive?: unknown;
    };
    if (typeof claims.userId !== 'string' || !claims.userId) {
      return fail(401, 'INVALID_AUTH_CLAIMS', 'The validated session did not contain a user id.');
    }
    if (typeof claims.activeOrgId !== 'string' || !claims.activeOrgId) {
      return fail(403, 'ORG_REQUIRED', 'Select an organization in QuikIT before opening Finova.');
    }
    // A suspended/archived org invalidates access immediately, independent of JWT expiry.
    if (claims.orgActive === false) {
      return fail(403, 'ORG_INACTIVE', 'This organization is not active.');
    }

    return {
      ok: true,
      identity: {
        userId: claims.userId,
        orgId: claims.activeOrgId,
        email: typeof claims.email === 'string' ? claims.email : undefined,
        orgRole: typeof claims.orgRole === 'string' ? claims.orgRole : null,
        isSuperAdmin: claims.isSuperAdmin === true,
      },
    };
  } catch {
    return fail(503, 'AUTH_SERVICE_UNAVAILABLE', 'The QuikIT authentication service could not be reached.');
  }
}

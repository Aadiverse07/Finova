import type { NextRequest } from 'next/server';

/** Minimal adapter for the documented QuikIT auth service contract.
 * Enable only when the deployment has the matching shared secrets/session setup.
 */
export type QuikITIdentity = {
  userId: string;
  email?: string;
  orgId: string;
  orgRole?: string | null;
  isSuperAdmin?: boolean;
};

export type AuthResult =
  | { ok: true; identity: QuikITIdentity }
  | { ok: false; status: 401 | 403 | 503; code: string; message: string };

export async function getQuikITIdentity(request: NextRequest): Promise<AuthResult> {
  if (process.env.QUIKIT_AUTH_ENABLED !== 'true') {
    return { ok: false, status: 503, code: 'QUIKIT_AUTH_DISABLED', message: 'QuikIT authentication is not enabled.' };
  }

  const authUrl = process.env.QUIKIT_AUTH_URL;
  const internalSecret = process.env.INTERNAL_SECRET;
  if (!authUrl || !internalSecret) {
    return { ok: false, status: 503, code: 'QUIKIT_AUTH_CONFIG_MISSING', message: 'QuikIT authentication is not configured.' };
  }

  const authorization = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');
  if (!authorization && !cookie) {
    return { ok: false, status: 401, code: 'UNAUTHENTICATED', message: 'A QuikIT session is required.' };
  }

  try {
    const headers = new Headers({ 'x-internal-secret': internalSecret });
    if (authorization) headers.set('authorization', authorization);
    if (cookie) headers.set('cookie', cookie);
    const response = await fetch(`${authUrl.replace(/\/$/, '')}/api/verify-token`, {
      method: 'GET', headers, cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return { ok: false, status: response.status === 403 ? 503 : 401, code: 'AUTH_SERVICE_REJECTED', message: 'QuikIT could not validate the session.' };
    }
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('valid' in body) || body.valid !== true) {
      return { ok: false, status: 401, code: 'UNAUTHENTICATED', message: 'The QuikIT session is invalid or expired.' };
    }
    const claims = body as { userId?: unknown; activeOrgId?: unknown; email?: unknown; orgRole?: unknown; isSuperAdmin?: unknown };
    if (typeof claims.userId !== 'string' || !claims.userId) {
      return { ok: false, status: 401, code: 'INVALID_AUTH_CLAIMS', message: 'The validated session did not contain a user id.' };
    }
    if (typeof claims.activeOrgId !== 'string' || !claims.activeOrgId) {
      return { ok: false, status: 403, code: 'ORG_REQUIRED', message: 'Select an organization in QuikIT before opening Ledger.' };
    }
    return { ok: true, identity: { userId: claims.userId, orgId: claims.activeOrgId, email: typeof claims.email === 'string' ? claims.email : undefined, orgRole: typeof claims.orgRole === 'string' ? claims.orgRole : null, isSuperAdmin: claims.isSuperAdmin === true } };
  } catch {
    return { ok: false, status: 503, code: 'AUTH_SERVICE_UNAVAILABLE', message: 'The QuikIT authentication service could not be reached.' };
  }
}

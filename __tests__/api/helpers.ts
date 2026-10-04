import { vi } from 'vitest';
import { NextRequest } from 'next/server';

/** Fake auth service: maps a bearer token to what GET /api/verify-token would answer. */
export type FakeSession = Record<string, unknown>;

export const SESSIONS: Record<string, FakeSession> = {
  tokA: { valid: true, userId: 'user_a', email: 'a@example.com', activeOrgId: 'org_A', orgRole: 'member', isSuperAdmin: false, orgActive: true },
  tokA_admin: { valid: true, userId: 'user_a2', email: 'a2@example.com', activeOrgId: 'org_A', orgRole: 'org_admin', isSuperAdmin: false, orgActive: true },
  tokB: { valid: true, userId: 'user_b', email: 'b@example.com', activeOrgId: 'org_B', orgRole: 'member', isSuperAdmin: false, orgActive: true },
  tokNoOrg: { valid: true, userId: 'user_c', email: 'c@example.com', activeOrgId: null, orgRole: null, isSuperAdmin: false, orgActive: true },
  tokSuspended: { valid: true, userId: 'user_d', email: 'd@example.com', activeOrgId: 'org_D', orgRole: 'member', isSuperAdmin: false, orgActive: false },
};

export function installFakeAuthService(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (headers.get('x-internal-secret') !== 'test-secret') {
      return new Response(JSON.stringify({ valid: false, error: 'Forbidden' }), { status: 403 });
    }
    const token = headers.get('authorization')?.replace(/^Bearer /, '');
    const session = token ? SESSIONS[token] : undefined;
    return new Response(JSON.stringify(session ?? { valid: false }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function enableAuthEnv(): void {
  process.env.QUIKIT_AUTH_ENABLED = 'true';
  process.env.QUIKIT_AUTH_URL = 'http://auth.test';
  process.env.INTERNAL_SECRET = 'test-secret';
  process.env.DATA_SOURCE = 'mock';
}

export function req(url: string, opts: { token?: string; method?: string; body?: unknown; rawBody?: string } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined || opts.rawBody !== undefined) headers['content-type'] = 'application/json';
  return new NextRequest(`http://localhost:3011${url}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
}

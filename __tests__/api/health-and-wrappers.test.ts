import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { GET as health } from '@/app/api/health/route';
import { GET as reports } from '@/app/api/reports/route';
import { requireAdmin, withOrgAuth } from '@/lib/api/withOrgAuth';
import { enableAuthEnv, installFakeAuthService, req } from './helpers';

describe('/api/health', () => {
  it('is public and returns { ok, version, db }', async () => {
    process.env.DATA_SOURCE = 'mock';
    const res = await health();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: expect.any(String), db: 'up' });
  });
});

describe('/api/reports', () => {
  beforeEach(() => {
    enableAuthEnv();
    installFakeAuthService();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('401 unauthenticated; 404 envelope when authenticated', async () => {
    expect((await reports(req('/api/reports'))).status).toBe(401);
    const res = await reports(req('/api/reports', { token: 'tokA' }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ success: false, error: 'Specify a report endpoint' });
  });
});

describe('auth wrappers', () => {
  beforeEach(() => {
    enableAuthEnv();
    installFakeAuthService();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('withOrgAuth passes the verified org/user and converts throws into a generic 500', async () => {
    const seen = withOrgAuth(async (ctx) => NextResponse.json({ orgId: ctx.orgId, userId: ctx.userId, actingAs: ctx.actingAs }));
    expect(await (await seen(req('/x', { token: 'tokB' }))).json()).toEqual({ orgId: 'org_B', userId: 'user_b', actingAs: 'user' });

    const boom = withOrgAuth(async () => {
      throw new Error('secret internals');
    });
    const res = await boom(req('/x', { token: 'tokA' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: 'Operation failed' });
  });

  it('requireAdmin: member -> 403, org_admin -> handler runs', async () => {
    const guarded = requireAdmin(async () => NextResponse.json({ success: true, data: 'ok' }));
    expect((await guarded(req('/x', { token: 'tokA' }))).status).toBe(403);
    expect((await guarded(req('/x', { token: 'tokA_admin' }))).status).toBe(200);
    expect((await guarded(req('/x'))).status).toBe(401);
  });
});

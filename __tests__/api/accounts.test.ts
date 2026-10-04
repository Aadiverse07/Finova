import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET, POST } from '@/app/api/accounts/route';
import { __resetMockStore } from '@/lib/repo/mock';
import { __resetRateLimits } from '@/lib/api/rateLimit';
import { enableAuthEnv, installFakeAuthService, req } from './helpers';

const cash = { code: '1000', name: 'Cash', type: 'ASSET', normalBalance: 'DEBIT' };

describe('/api/accounts', () => {
  beforeEach(() => {
    enableAuthEnv();
    installFakeAuthService();
    __resetMockStore();
    __resetRateLimits();
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('authentication', () => {
    it('401 without credentials, in the standard envelope', async () => {
      const res = await GET(req('/api/accounts'));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ success: false, error: expect.any(String) });
    });

    it('401 when the auth service says the session is invalid', async () => {
      const res = await GET(req('/api/accounts', { token: 'forged' }));
      expect(res.status).toBe(401);
    });

    it('403 when the session has no active organization', async () => {
      const res = await GET(req('/api/accounts', { token: 'tokNoOrg' }));
      expect(res.status).toBe(403);
    });

    it('403 when the organization is suspended', async () => {
      const res = await GET(req('/api/accounts', { token: 'tokSuspended' }));
      expect(res.status).toBe(403);
    });

    it('503 when QuikIT auth is disabled (never serves unscoped data)', async () => {
      process.env.QUIKIT_AUTH_ENABLED = 'false';
      const res = await GET(req('/api/accounts', { token: 'tokA' }));
      expect(res.status).toBe(503);
    });

    it('503 (not 401) when the auth service rejects our INTERNAL_SECRET', async () => {
      process.env.INTERNAL_SECRET = 'wrong-secret';
      const res = await GET(req('/api/accounts', { token: 'tokA' }));
      expect(res.status).toBe(503);
    });
  });

  describe('tenant isolation', () => {
    it('org B cannot see accounts created in org A', async () => {
      const created = await POST(req('/api/accounts', { token: 'tokA', method: 'POST', body: cash }));
      expect(created.status).toBe(201);

      const asA = await (await GET(req('/api/accounts', { token: 'tokA' }))).json();
      expect(asA.data.pagination.total).toBe(1);

      const asB = await (await GET(req('/api/accounts', { token: 'tokB' }))).json();
      expect(asB).toEqual({
        success: true,
        data: { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
      });
    });

    it('the same account code can exist in two orgs', async () => {
      expect((await POST(req('/api/accounts', { token: 'tokA', method: 'POST', body: cash }))).status).toBe(201);
      expect((await POST(req('/api/accounts', { token: 'tokB', method: 'POST', body: cash }))).status).toBe(201);
    });

    it('ignores any orgId supplied by the client', async () => {
      const res = await POST(req('/api/accounts', { token: 'tokA', method: 'POST', body: { ...cash, orgId: 'org_B' } }));
      expect(res.status).toBe(400); // .strict() rejects unknown keys, so it can never reach the repository
    });
  });

  describe('happy path and validation', () => {
    it('creates (201) then lists with the pagination envelope', async () => {
      const res = await POST(req('/api/accounts', { token: 'tokA', method: 'POST', body: cash }));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ code: '1000', name: 'Cash', type: 'ASSET', isSystem: false });

      const list = await (await GET(req('/api/accounts?limit=5', { token: 'tokA' }))).json();
      expect(list.data.data).toHaveLength(1);
      expect(list.data.pagination).toEqual({ page: 1, limit: 5, total: 1, totalPages: 1 });
    });

    it('paginates and filters by type', async () => {
      for (const [code, type, side] of [['1000', 'ASSET', 'DEBIT'], ['2000', 'LIABILITY', 'CREDIT'], ['1100', 'ASSET', 'DEBIT']]) {
        await POST(req('/api/accounts', { token: 'tokA', method: 'POST', body: { code, name: `Acc ${code}`, type, normalBalance: side } }));
      }
      const assets = await (await GET(req('/api/accounts?type=ASSET&limit=1&page=2', { token: 'tokA' }))).json();
      expect(assets.data.pagination).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
      expect(assets.data.data[0].code).toBe('1100');
    });

    it('400 on invalid body, invalid JSON and invalid query', async () => {
      const bad = await POST(req('/api/accounts', { token: 'tokA', method: 'POST', body: { code: '', name: 'x' } }));
      expect(bad.status).toBe(400);
      expect((await bad.json()).success).toBe(false);

      const notJson = await POST(req('/api/accounts', { token: 'tokA', method: 'POST', rawBody: '{nope' }));
      expect(notJson.status).toBe(400);

      const badQuery = await GET(req('/api/accounts?type=NOPE', { token: 'tokA' }));
      expect(badQuery.status).toBe(400);
    });

    it('409 on a duplicate code within the same org', async () => {
      await POST(req('/api/accounts', { token: 'tokA', method: 'POST', body: cash }));
      const dup = await POST(req('/api/accounts', { token: 'tokA', method: 'POST', body: cash }));
      expect(dup.status).toBe(409);
    });

    it('429 once the per-user create limit is exceeded', async () => {
      let last = 201;
      for (let i = 0; i < 31; i += 1) {
        const res = await POST(
          req('/api/accounts', { token: 'tokA', method: 'POST', body: { ...cash, code: `C${i}` } }),
        );
        last = res.status;
      }
      expect(last).toBe(429);
    });
  });
});

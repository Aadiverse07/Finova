import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET, POST } from '@/app/api/journal/route';
import { enableAuthEnv, installFakeAuthService, req } from './helpers';

const entry = {
  date: '2026-09-28',
  memo: 'Opening balance',
  lines: [
    { accountId: 'cash', debit: 1000 },
    { accountId: 'capital', credit: 1000 },
  ],
};

describe('/api/journal', () => {
  beforeEach(() => {
    enableAuthEnv();
    installFakeAuthService();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('401 unauthenticated (GET and POST)', async () => {
    expect((await GET(req('/api/journal'))).status).toBe(401);
    expect((await POST(req('/api/journal', { method: 'POST', body: entry }))).status).toBe(401);
  });

  it('GET returns an empty, org-scoped page in the envelope', async () => {
    const body = await (await GET(req('/api/journal', { token: 'tokB' }))).json();
    expect(body).toEqual({
      success: true,
      data: { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
    });
  });

  it('POST validates the body (400) before reporting persistence as not implemented (501)', async () => {
    const invalid = await POST(req('/api/journal', { token: 'tokA', method: 'POST', body: { ...entry, lines: [entry.lines[0]] } }));
    expect(invalid.status).toBe(400);

    const valid = await POST(req('/api/journal', { token: 'tokA', method: 'POST', body: entry }));
    expect(valid.status).toBe(501);
    expect(await valid.json()).toEqual({ success: false, error: expect.any(String) });
  });
});

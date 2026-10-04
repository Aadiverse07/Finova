import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/search/nl/route';
import { seedAccounts, seedEntries, seedExpenses, seedInvoices } from '@/lib/data/seed';
import { enableAuthEnv, installFakeAuthService, req } from './helpers';

const loadWorkspace = vi.fn(async (orgId: string) => ({ accounts: seedAccounts, entries: seedEntries, invoices: orgId === 'org_B' ? [] : seedInvoices, expenses: seedExpenses }));
vi.mock('@/lib/assistant/prisma-workspace', () => ({ loadWorkspace }));

describe('/api/search/nl', () => {
  beforeEach(() => { enableAuthEnv(); process.env.DATA_SOURCE = 'prisma'; process.env.NL_SEARCH_LLM = 'false'; installFakeAuthService(); loadWorkspace.mockClear(); });
  afterEach(() => vi.unstubAllGlobals());

  it('rejects unauthenticated requests', async () => expect((await POST(req('/api/search/nl', { method: 'POST', body: { question: 'show invoices' } }))).status).toBe(401));
  it('validates empty and overlong questions', async () => {
    expect((await POST(req('/api/search/nl', { method: 'POST', token: 'tokA', body: { question: '' } }))).status).toBe(400);
    expect((await POST(req('/api/search/nl', { method: 'POST', token: 'tokA', body: { question: 'x'.repeat(401) } }))).status).toBe(400);
  });
  it('refuses write and out-of-scope requests before workspace loading', async () => {
    expect((await POST(req('/api/search/nl', { method: 'POST', token: 'tokA', body: { question: 'delete all marketing expenses' } }))).status).toBe(200);
    expect((await POST(req('/api/search/nl', { method: 'POST', token: 'tokA', body: { question: 'who won the cricket match' } }))).status).toBe(200);
    expect(loadWorkspace).not.toHaveBeenCalled();
  });
  it('uses the authenticated org workspace and returns the standard envelope', async () => {
    const a = await POST(req('/api/search/nl', { method: 'POST', token: 'tokA', body: { question: 'show invoices from Apex' } }));
    const b = await POST(req('/api/search/nl', { method: 'POST', token: 'tokB', body: { question: 'show invoices from Apex' } }));
    expect(a.status).toBe(200); expect(b.status).toBe(200);
    expect((await a.json()).data.groups[0].count).toBeGreaterThan(0);
    expect((await b.json()).data.groups[0].count).toBe(0);
    expect(loadWorkspace).toHaveBeenNthCalledWith(1, 'org_A');
    expect(loadWorkspace).toHaveBeenNthCalledWith(2, 'org_B');
  });
});

import { describe, expect, it } from 'vitest';
import { answerQuestion, isInScope, parsePeriod, type AssistantContext, type Workspace } from '@/lib/assistant/engine';
import { seedAccounts, seedEntries, seedExpenses, seedInvoices } from '@/lib/data/seed';
import { expensePostings } from '@/lib/data/posting';
import type { Expense } from '@/lib/data/types';

const NOW = '2026-10-02';
const base: Workspace = { accounts: seedAccounts, entries: seedEntries, invoices: seedInvoices, expenses: seedExpenses };

/** Seed + marketing spend in two months, mirroring the product brief's example. */
function withMarketing(): Workspace {
  const mk = (id: string, date: string, amount: number): Expense => ({ id, date, category: 'Marketing', vendor: 'Google Ads', description: 'Campaign', amount, paymentMethod: 'Bank Transfer', status: 'Paid', notes: '' });
  const extra = [mk('EXP-2026-030', '2026-10-01', 18450), mk('EXP-2026-031', '2026-09-10', 15250)];
  return { ...base, expenses: [...extra, ...base.expenses], entries: [...extra.flatMap(expensePostings).map((d, i) => ({ ...d, id: `JE-9${i}` })), ...base.entries] };
}
const ask = (q: string, ws: Workspace = base, context?: AssistantContext) => answerQuestion(q, ws, { now: NOW, context });

describe('assistant: scope guard (no data work, no LLM, for unrelated questions)', () => {
  it('refuses general-knowledge and creative requests', () => {
    for (const q of ['What is the capital of France?', "How's the weather?", 'Write me a poem about invoices', 'who invented the telephone']) {
      const r = ask(q); expect(r.inScope).toBe(false); expect(r.intent).toBe('out_of_scope');
    }
  });
  it('accepts finance, navigation and customer-name questions', () => {
    for (const q of ['Summarize my accounts', 'show transactions', 'what does Apex owe', 'open the dashboard', 'how do I add an expense']) expect(isInScope(q, base)).toBe(true);
  });
});

describe('assistant: the product-brief examples', () => {
  it('marketing spend with month-over-month comparison', () => {
    const r = ask('How much did I spend on marketing this month?', withMarketing());
    expect(r.intent).toBe('spending');
    expect(r.answer).toContain('₹18,450');
    expect(r.answer).toMatch(/₹3,200 higher than last month/);
  });
  it('unpaid invoices are found, totalled and flag overdue ones', () => {
    const r = ask('Show me unpaid invoices');
    expect(r.intent).toBe('invoices'); expect(r.answer).toContain('INV-2026-013'); expect(r.answer).toContain('INV-2026-014');
    expect(r.answer).toContain('₹1,50,900'); expect(r.answer).toMatch(/overdue/);
    expect(r.answer).not.toContain('INV-2026-012'); // paid
    expect(r.answer).not.toContain('INV-2026-015'); // draft
  });
  it('largest expense category, with shares', () => {
    const r = ask('Which expense category is costing me the most?');
    expect(r.answer).toContain('Rent Expense is your biggest expense'); expect(r.answer).toContain('40%');
  });
});

describe('assistant: intents', () => {
  it('falls back to the latest active month and says so', () => expect(ask('how much did I spend').answer).toMatch(/Nothing is recorded for October 2026 yet, so here’s September 2026/));
  it('honours explicit periods', () => expect(ask('how much did I spend on software in september').answer).toContain('₹18,600'));
  it('overdue only', () => { const r = ask('overdue invoices'); expect(r.answer).toContain('INV-2026-013'); expect(r.answer).not.toContain('INV-2026-014'); });
  it('who owes me the most', () => expect(ask('who owes me the most').answer).toContain('Apex Industries: ₹97,800 (65%)'));
  it('customer lookup by name', () => expect(ask('how much does BlueSky owe me').answer).toContain('₹53,100'));
  it('cash totals all cash+bank accounts, specific account narrows', () => {
    expect(ask('what is my cash balance').answer).toContain('₹1,64,263'); expect(ask('HDFC bank balance').answer).toContain('₹1,67,113');
  });
  it('profit and loss, balance sheet and trial balance agree with the ledger maths', () => {
    expect(ask('show profit and loss').answer).toContain('₹1,74,461');
    expect(ask('balance sheet').answer).toContain('Assets = Liabilities + Equity ✅');
    expect(ask('do my books balance?').answer).toContain('balance ✅');
  });
  it('record lookups', () => {
    expect(ask('details of INV-2026-013').answer).toContain('BlueSky Retail'); expect(ask('show EXP-2026-020').answer).toContain('Adobe'); expect(ask('what is JE-1004').answer).toContain('Office rent adjustment');
    expect(ask('details of INV-2026-999').answer).toMatch(/couldn’t find/);
  });
  it('journal entries filter by text, not by finance keywords', () => expect(ask('show journal entries about rent').answer).toContain('JE-1004'));
  it('insights flag overdue, concentration, drafts and negative cash', () => {
    const a = ask('any insights?').answer; expect(a).toMatch(/overdue invoice/); expect(a).toMatch(/Apex Industries accounts for 65%/); expect(a).toMatch(/draft invoice/); expect(a).toMatch(/negative balance/);
  });
  it('navigation and how-to', () => {
    expect(ask('open reports').links?.[0]?.href).toBe('/reports'); expect(ask('how do I mark an invoice paid').answer).toMatch(/Mark as Paid/);
  });
  it('voice-style transcripts (no punctuation, filler) work', () => expect(ask('uh how much did i spend on uber last 30 days').answer).toContain('₹1,240'));
});

describe('assistant: follow-ups keep context', () => {
  it('"and last month?" re-runs the previous intent with the new period', () => {
    const first = ask('how much did I spend on software in september'); const r = ask('and august?', base, first.context);
    expect(r.intent).toBe('spending'); expect(r.answer).toMatch(/August 2026/);
  });
});

describe('assistant: periods', () => {
  it('parses relative and named periods', () => {
    expect(parsePeriod('this month', NOW)).toMatchObject({ from: '2026-10-01', to: '2026-10-31' });
    expect(parsePeriod('last month', NOW)).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
    expect(parsePeriod('in march', NOW)).toMatchObject({ from: '2026-03-01' });
    expect(parsePeriod('this quarter', NOW)).toMatchObject({ from: '2026-10-01', to: '2026-12-31' }); // Indian FY Q3
    expect(parsePeriod('this financial year', NOW)).toMatchObject({ from: '2026-04-01', to: '2027-03-31' });
    expect(parsePeriod('i may need a report', NOW)).toBeUndefined(); // "may" the verb is not May
    expect(parsePeriod('market trends', NOW)).toBeUndefined();
  });
});

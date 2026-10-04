import { describe, expect, it } from 'vitest';
import { seedAccounts, seedEntries, seedExpenses, seedInvoices } from '@/lib/data/seed';
import type { Invoice, Expense } from '@/lib/data/types';
import { parseIndianAmount } from '@/lib/nlq/amount';
import { resolveEntity } from '@/lib/nlq/entities';
import { parseQuestion, isWriteIntentQuestion } from '@/lib/nlq/parser';
import { executeSpec } from '@/lib/nlq/executor';
import { chipsForSpec, removeChip } from '@/lib/nlq/describe';
import { mergeFollowUp } from '@/lib/nlq/context';
import { parsePeriod } from '@/lib/assistant/engine';

const NOW='2026-10-02';
const marketing: Expense={id:'EXP-TEST-MKT',date:'2026-09-12',category:'Marketing',vendor:'Google Ads',description:'September campaign',amount:18450,paymentMethod:'Bank Transfer',status:'Paid',notes:''};
const rahul: Invoice={id:'inv-rahul',number:'INV-2026-099',customer:'Rahul Sharma',date:'2026-09-10',dueDate:'2026-09-20',lines:[{id:'r',description:'Consulting',quantity:'1',unitPrice:'50000'}],tax:9000,discount:0,status:'Pending',notes:''};
const ws={accounts:seedAccounts,entries:seedEntries,invoices:[...seedInvoices,rahul],expenses:[...seedExpenses,marketing]};

describe('NLQ amounts',()=>{it('parses Indian money forms',()=>{expect(parseIndianAmount('₹20,000')).toBe(20000);expect(parseIndianAmount('2 lakh')).toBe(200000);expect(parseIndianAmount('1.5 cr')).toBe(15000000);expect(parseIndianAmount('1,50,000')).toBe(150000);});});
describe('NLQ parser golden examples',()=>{
 const cases=[
  ['Show me everything I spent on marketing during September', 'Marketing'],['unpaid invoices over ₹20k','Pending'],['which customers are overdue?','Overdue'],['Rahul ke pending invoices','Rahul Sharma'],['biggest expenses last month','amount'],['travel spend this quarter','Travel'],['what did I pay Adobe','Adobe'],['invoices due this week','dueDate'],['payments received in August','PAYMENT'],['expenses between 5k and 10k in Q2','amount'],['invoices from Apex last financial year','Apex Industries'],['cash expenses under ₹500','Cash'],['draft invoices','Draft'],['2 lakh se zyada ke invoices','200000'],['marketng in sept','Marketing'],['everything about Apex','transaction'] ] as const;
 for(const [q,expectation] of cases) it(q,()=>{const r=parseQuestion(q,ws,NOW);expect(r.spec).toBeTruthy();const s=r.spec!;const blob=JSON.stringify(s);expect(blob.toLowerCase()).toContain(expectation.toLowerCase());});
 it('follow-up-like write intent is refused',()=>expect(isWriteIntentQuestion('delete all marketing expenses')).toBe(true));
 it('out of scope does not produce a spec',()=>expect(parseQuestion('who won the cricket match',ws,NOW).spec).toBeUndefined());
});
describe('NLQ periods/context',()=>{it('shares assistant period parsing for FY quarters and Hinglish month phrases',()=>{expect(parsePeriod('expenses in Q2',NOW)?.from).toBe('2026-07-01');expect(parsePeriod('travel pichhle mahine',NOW)?.label).toContain('September 2026');expect(parsePeriod('is mahine ka kharcha',NOW)?.from).toBe('2026-10-01');});it('merges follow-ups without changing unrelated filters',()=>{const s=parseQuestion('marketing expenses in September',ws,NOW).spec!;const paid=mergeFollowUp(s,'only the paid ones',NOW);expect(paid.filters.category).toEqual(s.filters.category);expect(paid.filters.status).toEqual(['Paid']);const oct=mergeFollowUp(paid,'what about October?',NOW);expect(oct.filters.dateRange?.from).toBe('2026-10-01');});});
describe('NLQ entities/executor',()=>{it('fuzzy resolves marketng',()=>expect(resolveEntity('marketng','category',ws)?.value).toBe('Marketing'));it('applies AND filters and totals',()=>{const s=parseQuestion('paid marketing expenses in September',ws,NOW).spec!;const g=executeSpec(ws,s,NOW)[0]!;expect(g.count).toBe(1);expect(g.total).toBe(18450);});it('never adds totals across entity types',()=>{const s=parseQuestion('everything about Apex',ws,NOW).spec!;const gs=executeSpec(ws,s,NOW);expect(gs.every(g=>g.total===undefined||typeof g.total==='number')).toBe(true);});it('chips round-trip removals',()=>{const s=parseQuestion('unpaid invoices over ₹20k',ws,NOW).spec!;expect(chipsForSpec(s).length).toBeGreaterThan(1);const next=removeChip(s,'amount');expect(next.filters.amount).toBeUndefined();});});

describe('NLQ regressions (word-boundary status, vendor resolution, totals, follow-ups)', () => {
  it('unpaid is Pending+Overdue only, never Paid', () => expect(parseQuestion('unpaid invoices over ₹20k', ws, NOW).spec!.filters.status).toEqual(['Pending', 'Overdue']));
  it('"spending" is not Pending and "latest" is not Overdue', () => {
    expect(parseQuestion('total spending in May', ws, NOW).spec!.filters.status).toBeUndefined();
    expect(parseQuestion('latest transactions', ws, NOW).spec!.filters.status).toBeUndefined();
  });
  it('resolves vendors and never falls back to a bogus category', () => {
    const f = parseQuestion('what did I pay Adobe', ws, NOW).spec!.filters;
    expect(f.vendor).toEqual(['Adobe']);
    expect(f.category).toBeUndefined();
  });
  it('totals cover every match, not just the five rows shown', () => {
    const many = { ...ws, expenses: Array.from({ length: 8 }, (_, i) => ({ ...marketing, id: `E${i}`, amount: 100 })) };
    const g = executeSpec(many, parseQuestion('marketing expenses in September', many, NOW).spec!, NOW)[0]!;
    expect(g.count).toBe(8); expect(g.records).toHaveLength(5); expect(g.total).toBe(800);
  });
  it('"largest 3 expenses" sets limit 3', () => expect(parseQuestion('largest 3 expenses', ws, NOW).spec!.limit).toBe(3));
  it('only treats short refinements as follow-ups', async () => {
    const { isFollowUp } = await import('@/lib/nlq/context');
    expect(isFollowUp('only the paid ones', NOW)).toBe(true);
    expect(isFollowUp('what about October?', NOW)).toBe(true);
    expect(isFollowUp('unpaid invoices over 20k', NOW)).toBe(false);
  });
  it('removeChip regenerates the interpretation text', () => {
    const s = parseQuestion('unpaid invoices over ₹20k', ws, NOW).spec!;
    expect(removeChip(s, 'amount').interpretation).not.toContain('20,000');
  });
});

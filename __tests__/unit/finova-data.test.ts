import { describe, expect, it } from 'vitest';
import { seedAccounts, seedEntries, seedInvoices } from '@/lib/data/seed';
import { balanceSheet, invoiceStatus, invoiceTotal, ledgerFor, nextInvoiceNumber, profitAndLoss, trialBalance } from '@/lib/data/calc';
import { expensePostings, invoicePostings } from '@/lib/data/posting';
import { isBalancedJournal } from '@/lib/ledger/journal-validation';

const sumLines = (e: { lines: { debit: number; credit: number }[] }) => e.lines.reduce((s, l) => s + l.debit - l.credit, 0);

describe('finova demo ledger', () => {
  it('every seeded entry is balanced', () => {
    for (const e of seedEntries) expect(Math.abs(sumLines(e))).toBeLessThan(0.005);
  });

  it('trial balance and balance sheet balance', () => {
    expect(trialBalance(seedAccounts, seedEntries).balanced).toBe(true);
    expect(balanceSheet(seedAccounts, seedEntries).balanced).toBe(true);
  });

  it('profit & loss = revenue - expenses', () => {
    const pl = profitAndLoss(seedAccounts, seedEntries);
    expect(pl.netProfit).toBeCloseTo(pl.totalIncome - pl.totalExpenses, 2);
  });

  it('date filter narrows the ledger and carries an opening balance', () => {
    const bank = seedAccounts.find((a) => a.id === '1001')!;
    const all = ledgerFor(bank, seedEntries);
    const later = ledgerFor(bank, seedEntries, '2026-09-29');
    expect(later.rows.length).toBeLessThan(all.rows.length);
    expect(later.closing).toBe(all.closing);
    expect(later.opening).toBeGreaterThan(0);
  });
});

describe('invoices and expenses', () => {
  it('derives Overdue from the due date only for Pending invoices', () => {
    const pending = seedInvoices.find((i) => i.id === 'inv-2')!;
    expect(invoiceStatus(pending, '2026-10-02')).toBe('Overdue');
    expect(invoiceStatus(pending, '2026-09-30')).toBe('Pending');
    expect(invoiceStatus(seedInvoices.find((i) => i.status === 'Paid')!, '2030-01-01')).toBe('Paid');
  });

  it('draft invoices post nothing; paid invoices post recognition plus receipt', () => {
    const draft = seedInvoices.find((i) => i.status === 'Draft')!;
    const paid = seedInvoices.find((i) => i.status === 'Paid')!;
    expect(invoicePostings(draft)).toHaveLength(0);
    const posted = invoicePostings(paid);
    expect(posted).toHaveLength(2);
    expect(posted[0]?.lines.find((l) => l.accountId === '1100')!.debit).toBe(invoiceTotal(paid));
    posted.forEach((e) => expect(Math.abs(sumLines(e))).toBeLessThan(0.005));
  });

  it('pending expenses credit Accounts Payable, paid expenses credit the bank', () => {
    const base = { id: 'E1', date: '2026-10-01', category: 'Travel', vendor: 'Uber', description: 'Cab', amount: 100.1, paymentMethod: 'UPI', notes: '' };
    expect(expensePostings({ ...base, status: 'Pending' })[0]?.lines.some((l) => l.accountId === '2001' && l.credit === 100.1)).toBe(true);
    expect(expensePostings({ ...base, status: 'Paid' })[0]?.lines.some((l) => l.accountId === '1001' && l.credit === 100.1)).toBe(true);
  });

  it('next invoice number follows the highest existing number', () => {
    expect(nextInvoiceNumber(seedInvoices)).toBe('INV-2026-016');
  });
});

describe('journal validation precision', () => {
  it('does not fail on floating point drift', () => {
    expect(isBalancedJournal([{ debit: 0.1, credit: 0 }, { debit: 0.2, credit: 0 }, { debit: 0, credit: 0.3 }])).toBe(true);
  });
});

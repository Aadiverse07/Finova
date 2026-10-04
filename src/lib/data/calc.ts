import type { Account, Expense, Invoice, InvoiceStatus, JournalEntry } from './types';
import { addDays, r2, todayISO } from './format';

/* ---------- invoices ---------- */
export const invoiceSubtotal = (i: Pick<Invoice, 'lines'>) =>
  r2(i.lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0));
export const invoiceTotal = (i: Pick<Invoice, 'lines' | 'tax' | 'discount'>) => r2(invoiceSubtotal(i) + i.tax - i.discount);
export const invoiceStatus = (i: Invoice, today = todayISO()): InvoiceStatus =>
  i.status === 'Pending' && i.dueDate < today ? 'Overdue' : i.status;

const lastNumber = (ids: string[]) => ids.reduce((m, id) => Math.max(m, Number(id.match(/(\d+)$/)?.[1] ?? 0)), 0);
export const nextInvoiceNumber = (invoices: Invoice[]) => `INV-2026-${String(lastNumber(invoices.map((i) => i.number)) + 1).padStart(3, '0')}`;
export const nextExpenseId = (expenses: Expense[]) => `EXP-2026-${String(lastNumber(expenses.map((e) => e.id)) + 1).padStart(3, '0')}`;
export const nextEntryId = (entries: JournalEntry[]) => `JE-${lastNumber(entries.map((e) => e.id)) + 1}`;

/* ---------- ledger maths (amounts are rupees, rounded to paise) ---------- */
type Range = { from?: string; to?: string };
export type Totals = { debit: number; credit: number };
const inRange = (date: string, { from, to }: Range) => (!from || date >= from) && (!to || date <= to);
const posted = (entries: JournalEntry[]) => entries.filter((e) => e.status === 'Posted');

export const signed = (a: Account, t: Totals) => r2(a.normalBalance === 'DEBIT' ? t.debit - t.credit : t.credit - t.debit);

export function accountTotals(entries: JournalEntry[], range: Range = {}): Map<string, Totals> {
  const map = new Map<string, Totals>();
  for (const e of posted(entries)) {
    if (!inRange(e.date, range)) continue;
    for (const l of e.lines) {
      const t = map.get(l.accountId) ?? { debit: 0, credit: 0 };
      t.debit = r2(t.debit + l.debit);
      t.credit = r2(t.credit + l.credit);
      map.set(l.accountId, t);
    }
  }
  return map;
}

export function accountBalance(a: Account, entries: JournalEntry[], range: Range = {}) {
  return signed(a, accountTotals(entries, range).get(a.id) ?? { debit: 0, credit: 0 });
}

export function ledgerFor(a: Account, entries: JournalEntry[], from?: string, to?: string) {
  const opening = from ? accountBalance(a, entries, { to: addDays(from, -1) }) : 0;
  const rows = posted(entries)
    .filter((e) => inRange(e.date, { from, to }))
    .sort((x, y) => x.date.localeCompare(y.date) || x.id.localeCompare(y.id, undefined, { numeric: true }))
    .flatMap((e) => e.lines.filter((l) => l.accountId === a.id).map((l) => ({ entry: e, line: l })));
  let running = opening;
  let debit = 0;
  let credit = 0;
  const out = rows.map(({ entry, line }) => {
    running = r2(running + (a.normalBalance === 'DEBIT' ? line.debit - line.credit : line.credit - line.debit));
    debit = r2(debit + line.debit);
    credit = r2(credit + line.credit);
    return { key: `${entry.id}-${line.id}`, date: entry.date, reference: entry.reference, description: entry.description, debit: line.debit, credit: line.credit, balance: running };
  });
  return { opening, rows: out, debit, credit, closing: running };
}

export function trialBalance(accounts: Account[], entries: JournalEntry[], to?: string) {
  const totals = accountTotals(entries, { to });
  const rows = accounts
    .map((a) => {
      const t = totals.get(a.id) ?? { debit: 0, credit: 0 };
      const net = r2(t.debit - t.credit);
      return { account: a, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0, active: t.debit !== 0 || t.credit !== 0 };
    })
    .filter((r) => r.active);
  const debit = r2(rows.reduce((s, r) => s + r.debit, 0));
  const credit = r2(rows.reduce((s, r) => s + r.credit, 0));
  return { rows, debit, credit, balanced: debit === credit, difference: r2(debit - credit) };
}

export function profitAndLoss(accounts: Account[], entries: JournalEntry[], from?: string, to?: string) {
  const totals = accountTotals(entries, { from, to });
  const pick = (type: Account['type']) =>
    accounts
      .filter((a) => a.type === type)
      .map((a) => ({ account: a, amount: signed(a, totals.get(a.id) ?? { debit: 0, credit: 0 }) }))
      .filter((r) => r.amount !== 0);
  const income = pick('INCOME');
  const expenses = pick('EXPENSE');
  const totalIncome = r2(income.reduce((s, r) => s + r.amount, 0));
  const totalExpenses = r2(expenses.reduce((s, r) => s + r.amount, 0));
  const netProfit = r2(totalIncome - totalExpenses);
  return { income, expenses, totalIncome, totalExpenses, netProfit, margin: totalIncome ? (netProfit / totalIncome) * 100 : 0 };
}

export function balanceSheet(accounts: Account[], entries: JournalEntry[], to?: string) {
  const totals = accountTotals(entries, { to });
  const pick = (type: Account['type']) =>
    accounts
      .filter((a) => a.type === type)
      .map((a) => ({ account: a, amount: signed(a, totals.get(a.id) ?? { debit: 0, credit: 0 }) }))
      .filter((r) => r.amount !== 0);
  const assets = pick('ASSET');
  const liabilities = pick('LIABILITY');
  const equity = pick('EQUITY');
  const pl = profitAndLoss(accounts, entries, undefined, to);
  const sum = (rows: { amount: number }[]) => r2(rows.reduce((s, r) => s + r.amount, 0));
  const totalAssets = sum(assets);
  const totalLiabilities = sum(liabilities);
  const totalEquity = r2(sum(equity) + pl.netProfit);
  return { assets, liabilities, equity, currentEarnings: pl.netProfit, totalAssets, totalLiabilities, totalEquity, balanced: totalAssets === r2(totalLiabilities + totalEquity) };
}

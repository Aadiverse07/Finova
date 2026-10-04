import type { Account, Expense, Invoice, JournalEntry } from '@/lib/data/types';
import type { Workspace } from './engine';

const rupees = (paise: bigint | number) => Number(paise) / 100;
const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Loads one organisation's records (ALWAYS scoped by orgId) and maps them to the same Workspace shape the
 * browser store uses, so the server and the UI answer from identical logic. DB amounts are paise (BigInt);
 * the engine works in rupees. Journal entries are intentionally not capped: a cap would corrupt balances.
 */
export async function loadWorkspace(orgId: string): Promise<Workspace> {
  const { db } = await import('@/lib/db');
  const [accountRows, entryRows, invoiceRows, expenseRows] = await Promise.all([
    db.account.findMany({ where: { orgId } }),
    db.journalEntry.findMany({ where: { orgId }, include: { lines: true }, orderBy: { entryNo: 'desc' } }),
    db.invoice.findMany({ where: { orgId, status: { not: 'VOID' } }, include: { lines: true }, orderBy: { issueDate: 'desc' }, take: 5000 }),
    db.expense.findMany({ where: { orgId }, orderBy: { date: 'desc' }, take: 5000 }),
  ]);

  const accounts: Account[] = accountRows.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type, normalBalance: a.normalBalance, isActive: a.isActive, description: '' }));
  const byId = new Map(accountRows.map((a) => [a.id, a]));

  const entries: JournalEntry[] = entryRows.map((e) => ({
    id: `JE-${e.entryNo}`, date: day(e.date), reference: e.sourceRef ?? `JE-${e.entryNo}`, description: e.memo, status: 'Posted',
    source: (e.source === 'REVERSAL' ? 'MANUAL' : e.source) as JournalEntry['source'], sourceRef: e.sourceRef ?? undefined,
    lines: e.lines.map((l) => ({ id: l.id, accountId: l.accountId, debit: rupees(l.debit), credit: rupees(l.credit) })),
  }));

  const invoices: Invoice[] = invoiceRows.map((i) => {
    const lineSum = i.lines.reduce((s, l) => s + Number(l.qty) * rupees(l.unitPrice), 0);
    return {
      id: i.id, number: i.number, customer: i.customerName, date: day(i.issueDate), dueDate: day(i.dueDate),
      lines: i.lines.map((l) => ({ id: l.id, description: l.description, quantity: l.qty.toString(), unitPrice: String(rupees(l.unitPrice)) })),
      tax: rupees(i.cgst + i.sgst + i.igst), discount: Math.max(0, Math.round((lineSum - rupees(i.subtotal)) * 100) / 100),
      status: i.status === 'PAID' ? 'Paid' : i.status === 'DRAFT' ? 'Draft' : 'Pending', notes: '',
    };
  });

  const expenses: Expense[] = expenseRows.map((x) => ({
    id: x.id, date: day(x.date), category: byId.get(x.accountId)?.name ?? 'Uncategorized', vendor: x.vendor, description: x.note ?? '', amount: rupees(x.amount),
    paymentMethod: byId.get(x.paidFromAccountId)?.name ?? 'Bank', status: byId.get(x.paidFromAccountId)?.type === 'LIABILITY' ? 'Pending' : 'Paid', notes: x.note ?? '',
  }));

  return { accounts, entries, invoices, expenses };
}

import { create } from 'zustand';
import type { Account, Expense, Invoice, JournalDraft, JournalEntry } from './types';
import { seedAccounts, seedEntries, seedExpenses, seedInvoices } from './seed';
import { nextEntryId, nextExpenseId } from './calc';
import { expensePostings, invoicePostings } from './posting';
import { todayISO } from './format';

/**
 * Single client data layer for every finance module. Pages only call these actions/selectors, so swapping
 * the seed for real API calls (/api/accounts, /api/journal, ...) means changing this file only.
 */
type State = {
  accounts: Account[];
  entries: JournalEntry[];
  invoices: Invoice[];
  expenses: Expense[];
  addAccount: (a: Omit<Account, 'id' | 'isActive'>) => void;
  addEntry: (d: JournalDraft) => JournalEntry;
  saveInvoice: (inv: Invoice) => void;
  markInvoicePaid: (id: string) => void;
  cancelInvoice: (id: string) => void;
  addExpense: (e: Omit<Expense, 'id'>) => Expense;
  deleteExpense: (id: string) => void;
  replaceWorkspace: (workspace: { accounts: Account[]; entries: JournalEntry[]; invoices: Invoice[]; expenses: Expense[] }) => void;
};

const linked = (e: JournalEntry, id: string) => e.sourceRef === id || e.sourceRef?.startsWith(`${id}:`);
function withDrafts(entries: JournalEntry[], drafts: JournalDraft[]): JournalEntry[] {
  const out = [...entries];
  for (const d of drafts) out.unshift({ ...d, id: nextEntryId(out) });
  return out;
}
const lastInvoiceId = (xs: Invoice[]) => xs.reduce((m, i) => Math.max(m, Number(i.id.replace(/\D/g, '')) || 0), 0);

export const useFinova = create<State>((set, get) => ({
  accounts: seedAccounts,
  entries: seedEntries,
  invoices: seedInvoices,
  expenses: seedExpenses,

  addAccount: (a) => set((s) => ({ accounts: [...s.accounts, { ...a, id: a.code, isActive: true }].sort((x, y) => x.code.localeCompare(y.code)) })),

  addEntry: (d) => {
    const created: JournalEntry = { ...d, id: nextEntryId(get().entries) };
    set((s) => ({ entries: [created, ...s.entries] }));
    return created;
  },

  saveInvoice: (inv) =>
    set((s) => {
      const exists = s.invoices.some((i) => i.id === inv.id);
      const saved = exists ? inv : { ...inv, id: `inv-${lastInvoiceId(s.invoices) + 1}` };
      return {
        invoices: exists ? s.invoices.map((i) => (i.id === inv.id ? saved : i)) : [saved, ...s.invoices],
        entries: withDrafts(s.entries.filter((e) => !linked(e, saved.id)), invoicePostings(saved)),
      };
    }),

  markInvoicePaid: (id) =>
    set((s) => {
      const inv = s.invoices.find((i) => i.id === id);
      if (!inv || inv.status === 'Paid') return s;
      const paid: Invoice = { ...inv, status: 'Paid', paidOn: todayISO() };
      return {
        invoices: s.invoices.map((i) => (i.id === id ? paid : i)),
        entries: withDrafts(s.entries.filter((e) => !linked(e, id)), invoicePostings(paid)),
      };
    }),

  cancelInvoice: (id) => set((s) => ({ invoices: s.invoices.filter((i) => i.id !== id), entries: s.entries.filter((e) => !linked(e, id)) })),

  addExpense: (e) => {
    const expense: Expense = { ...e, id: nextExpenseId(get().expenses) };
    set((s) => ({ expenses: [expense, ...s.expenses], entries: withDrafts(s.entries, expensePostings(expense)) }));
    return expense;
  },

  deleteExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id), entries: s.entries.filter((e) => !linked(e, id)) })),
  replaceWorkspace: (workspace) => set(() => workspace),
}));

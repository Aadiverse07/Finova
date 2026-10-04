import type { Expense, Invoice, JournalDraft } from './types';
import { invoiceSubtotal, invoiceTotal } from './calc';
import { r2 } from './format';

/** Fixed system accounts used for auto-posting. Codes match seed.ts. */
export const ACC = { bank: '1001', cash: '1002', receivable: '1100', payable: '2001', gst: '2100', sales: '4001' } as const;

export const expenseCategoryAccount: Record<string, string> = {
  'Office Supplies': '5001',
  Rent: '5100',
  Software: '5200',
  Travel: '5300',
  Utilities: '5400',
  Marketing: '5500',
};
export const paymentMethods = ['Bank Transfer', 'Company Card', 'UPI', 'Cash', 'Auto Debit'];
const paymentAccount = (method: string) => (method === 'Cash' ? ACC.cash : ACC.bank);

const lines = (rows: [string, number, number][]) =>
  rows.filter(([, d, c]) => d > 0 || c > 0).map(([accountId, debit, credit], i) => ({ id: `l${i + 1}`, accountId, debit: r2(debit), credit: r2(credit) }));

/** Journal entries an invoice produces: recognition (unless Draft) plus a receipt when Paid. */
export function invoicePostings(inv: Invoice): JournalDraft[] {
  if (inv.status === 'Draft') return [];
  const total = invoiceTotal(inv);
  const sales = r2(invoiceSubtotal(inv) - inv.discount);
  const out: JournalDraft[] = [
    {
      date: inv.date, reference: inv.number, description: `Invoice ${inv.number} - ${inv.customer}`,
      status: 'Posted', source: 'INVOICE', sourceRef: inv.id,
      lines: lines([[ACC.receivable, total, 0], [ACC.sales, 0, sales], [ACC.gst, 0, inv.tax]]),
    },
  ];
  if (inv.status === 'Paid') {
    out.push({
      date: inv.paidOn ?? inv.date, reference: `RCPT-${inv.number}`, description: `Receipt for ${inv.number} - ${inv.customer}`,
      status: 'Posted', source: 'PAYMENT', sourceRef: `${inv.id}:rcpt`,
      lines: lines([[ACC.bank, total, 0], [ACC.receivable, 0, total]]),
    });
  }
  return out;
}

export function expensePostings(e: Expense): JournalDraft[] {
  const expenseAccount = expenseCategoryAccount[e.category] ?? '5001';
  const creditAccount = e.status === 'Paid' ? paymentAccount(e.paymentMethod) : ACC.payable;
  return [
    {
      date: e.date, reference: e.id, description: `${e.category} - ${e.vendor}: ${e.description}`,
      status: 'Posted', source: 'EXPENSE', sourceRef: e.id,
      lines: lines([[expenseAccount, e.amount, 0], [creditAccount, 0, e.amount]]),
    },
  ];
}

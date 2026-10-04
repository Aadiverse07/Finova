import { invoiceStatus, invoiceTotal } from '@/lib/data/calc';
import { r2 } from '@/lib/data/format';
import type { Workspace } from '@/lib/assistant/engine';
import type { EntityKind, NlqGroup, NlqRecord, QuerySpec } from './types';

type Range = QuerySpec['filters']['dateRange'];
const inRange = (date: string, range?: Range) => !range || (date >= range.from && date <= range.to);
const amountOk = (amount: number, filter?: QuerySpec['filters']['amount']) => !filter || ((filter.min === undefined || amount >= filter.min) && (filter.max === undefined || amount <= filter.max));
const includes = (haystack: string, values?: string[]) => !values?.length || values.some((value) => haystack.toLowerCase().includes(value.toLowerCase()));
const sortRecords = (records: NlqRecord[], spec: QuerySpec) => {
  if (!spec.sort) return records;
  const field = spec.sort.field;
  const key = (r: NlqRecord) => (field === 'amount' ? r.amount ?? 0 : field === 'dueDate' ? r.dueDate ?? r.date ?? '' : r.date ?? '');
  return [...records].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * (spec.sort?.dir === 'asc' ? 1 : -1));
};

/** Pure, read-only. Amounts are rupees; totals are per entity type and cover ALL matches, never just the rows shown. */
export function executeSpec(ws: Workspace, spec: QuerySpec, now: string): NlqGroup[] {
  const f = spec.filters;
  const text = f.text?.toLowerCase();
  const matchExpense = (e: Workspace['expenses'][number]) => inRange(e.date, f.dateRange) && includes(e.category, f.category) && includes(e.vendor, f.vendor) && includes(e.paymentMethod, f.paymentMethod) && (!f.status?.length || f.status.includes(e.status)) && amountOk(e.amount, f.amount) && (!text || `${e.id} ${e.vendor} ${e.category} ${e.description}`.toLowerCase().includes(text));
  const matchInvoice = (i: Workspace['invoices'][number]) => {
    const date = f.dateRange?.field === 'dueDate' ? i.dueDate : f.dateRange?.field === 'paidOn' ? i.paidOn ?? i.date : i.date;
    return inRange(date, f.dateRange) && includes(i.customer, f.customer) && (!f.status?.length || f.status.includes(invoiceStatus(i, now))) && amountOk(invoiceTotal(i), f.amount) && (!text || `${i.number} ${i.customer} ${i.notes} ${i.lines.map((l) => l.description).join(' ')}`.toLowerCase().includes(text) || (text === 'gst' && i.tax > 0));
  };
  const expenses = ws.expenses.filter(matchExpense);
  const hasExpenseFilter = !!(f.category?.length || f.vendor?.length || f.paymentMethod?.length);
  const relatedToExpenses = hasExpenseFilter || (spec.entities.includes('expense') && !text);
  const relatedToInvoices = !relatedToExpenses && !!f.customer?.length;
  const invoices = relatedToInvoices ? ws.invoices.filter((i) => includes(i.customer, f.customer)) : [];
  const mentions = (hay: string, needles: string[]) => needles.some((n) => n && hay.includes(n.toLowerCase()));
  const linked = (entry: Workspace['entries'][number]) => {
    const hay = `${entry.reference} ${entry.description} ${entry.sourceRef ?? ''}`.toLowerCase();
    if (relatedToExpenses) return entry.source === 'EXPENSE' && expenses.some((e) => e.id === entry.sourceRef || mentions(hay, [e.id, e.vendor]));
    if (relatedToInvoices) return (entry.source === 'INVOICE' || entry.source === 'PAYMENT') && invoices.some((i) => i.id === entry.sourceRef || mentions(hay, [i.number, i.customer]));
    return true;
  };

  return spec.entities.map((entity: EntityKind) => {
    let records: NlqRecord[] = [];
    if (entity === 'expense') {
      records = expenses.map((e) => ({ entity, id: e.id, title: e.vendor, subtitle: `${e.category} · ${e.description}`, date: e.date, amount: r2(e.amount), status: e.status, href: `/expenses?open=${encodeURIComponent(e.id)}`, reason: 'matches your expense filters' }));
    } else if (entity === 'invoice') {
      records = ws.invoices.filter(matchInvoice).map((i) => ({ entity, id: i.id, title: i.number, subtitle: i.customer, date: i.date, dueDate: i.dueDate, amount: invoiceTotal(i), status: invoiceStatus(i, now), href: `/invoices?open=${encodeURIComponent(i.id)}`, reason: 'matches your invoice filters' }));
    } else if (entity === 'transaction') {
      records = ws.entries
        .filter((entry) => inRange(entry.date, f.dateRange) && (!f.source?.length || f.source.includes(entry.source)) && linked(entry) && (!f.account?.length || entry.lines.some((l) => f.account?.includes(l.accountId) || f.account?.includes(ws.accounts.find((a) => a.id === l.accountId)?.name ?? ''))) && (!text || `${entry.id} ${entry.reference} ${entry.description}`.toLowerCase().includes(text)))
        .map((entry) => ({ entity, id: entry.id, title: entry.reference, subtitle: entry.description, date: entry.date, amount: r2(entry.lines.reduce((sum, l) => sum + Math.max(l.debit, l.credit), 0)), status: entry.status, href: `/journal?open=${encodeURIComponent(entry.id)}`, reason: 'matches your transaction filters' }));
    } else if (entity === 'account') {
      records = ws.accounts.filter((a) => includes(`${a.code} ${a.name} ${a.description}`, f.account) && (!text || `${a.code} ${a.name} ${a.description}`.toLowerCase().includes(text))).map((a) => ({ entity, id: a.id, title: a.name, subtitle: `${a.code} · ${a.type}`, href: `/accounts?open=${encodeURIComponent(a.id)}`, reason: 'matches your account filter' }));
    } else {
      const names = [...new Set(ws.invoices.filter((i) => (!f.status?.length || f.status.includes(invoiceStatus(i, now))) && inRange(i.dueDate, f.dateRange)).map((i) => i.customer))].filter((n) => includes(n, f.customer) && (!text || n.toLowerCase().includes(text)));
      records = names.map((n) => ({ entity, id: n, title: n, subtitle: 'Customer with matching invoices', href: `/invoices?customer=${encodeURIComponent(n)}`, reason: 'matches your customer filter' }));
    }
    const limited = spec.limit ? sortRecords(records, spec).slice(0, spec.limit) : sortRecords(records, spec);
    // Journal amounts are not additive money, so only expenses/invoices get a total.
    const total = entity === 'expense' || entity === 'invoice' ? r2(limited.reduce((sum, r) => sum + (r.amount ?? 0), 0)) : undefined;
    return { entity, count: limited.length, total, records: limited.slice(0, 5) };
  });
}

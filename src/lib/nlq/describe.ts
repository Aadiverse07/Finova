import { querySpecSchema, type InterpretationChip, type QuerySpec, type EntityKind } from './types';

export function chipsForSpec(spec: QuerySpec): InterpretationChip[] {
  const chips: InterpretationChip[] = [];
  spec.entities.forEach((entity: EntityKind) => chips.push({ id: `entity-${entity}`, kind: 'entity', label: entity === 'expense' ? 'Expenses' : entity === 'invoice' ? 'Invoices' : entity === 'transaction' ? 'Transactions' : entity === 'account' ? 'Accounts' : 'Customers', value: entity }));
  if (spec.filters.text) chips.push({ id: 'text', kind: 'filter', label: `Text: ${spec.filters.text}`, value: spec.filters.text });
  if (spec.filters.category?.length) chips.push({ id: 'category', kind: 'filter', label: `Category: ${spec.filters.category.join(', ')}`, value: spec.filters.category.join(',') });
  if (spec.filters.vendor?.length) chips.push({ id: 'vendor', kind: 'filter', label: `Vendor: ${spec.filters.vendor.join(', ')}`, value: spec.filters.vendor.join(',') });
  if (spec.filters.customer?.length) chips.push({ id: 'customer', kind: 'filter', label: `Customer: ${spec.filters.customer.join(', ')}`, value: spec.filters.customer.join(',') });
  if (spec.filters.account?.length) chips.push({ id: 'account', kind: 'filter', label: `Account: ${spec.filters.account.join(', ')}`, value: spec.filters.account.join(',') });
  if (spec.filters.source?.length) chips.push({ id: 'source', kind: 'filter', label: `Source: ${spec.filters.source.join(' + ')}`, value: spec.filters.source.join(',') });
  if (spec.filters.status?.length) chips.push({ id: 'status', kind: 'status', label: `Status: ${spec.filters.status.join(' + ')}`, value: spec.filters.status.join(',') });
  if (spec.filters.paymentMethod?.length) chips.push({ id: 'method', kind: 'filter', label: `Payment: ${spec.filters.paymentMethod.join(', ')}`, value: spec.filters.paymentMethod.join(',') });
  if (spec.filters.dateRange) chips.push({ id: 'date', kind: 'period', label: spec.filters.dateRange.label, value: `${spec.filters.dateRange.from}:${spec.filters.dateRange.to}` });
  if (spec.filters.amount) chips.push({ id: 'amount', kind: 'amount', label: `Amount: ${spec.filters.amount.min !== undefined ? `≥ ₹${spec.filters.amount.min.toLocaleString('en-IN')}` : ''}${spec.filters.amount.min !== undefined && spec.filters.amount.max !== undefined ? ' · ' : ''}${spec.filters.amount.max !== undefined ? `≤ ₹${spec.filters.amount.max.toLocaleString('en-IN')}` : ''}` });
  if (spec.sort) chips.push({ id: 'sort', kind: 'filter', label: `Sort: ${spec.sort.field} ${spec.sort.dir}` });
  if (spec.limit) chips.push({ id: 'limit', kind: 'filter', label: `Top ${spec.limit}` });
  if (spec.aggregate) chips.push({ id: 'aggregate', kind: 'filter', label: `Aggregate: ${spec.aggregate}` });
  return chips;
}

export function describe(spec: QuerySpec) { return buildInterpretation(spec); }

export function removeChip(spec: QuerySpec, id: string): QuerySpec {
  const next = structuredClone(spec) as QuerySpec;
  if (id.startsWith('entity-')) next.entities = next.entities.filter((entity: EntityKind) => `entity-${entity}` !== id);
  if (id === 'text') delete next.filters.text;
  if (id === 'category') delete next.filters.category;
  if (id === 'vendor') delete next.filters.vendor;
  if (id === 'customer') delete next.filters.customer;
  if (id === 'account') delete next.filters.account;
  if (id === 'source') delete next.filters.source;
  if (id === 'status') delete next.filters.status;
  if (id === 'date') delete next.filters.dateRange;
  if (id === 'amount') delete next.filters.amount;
  if (id === 'method') delete next.filters.paymentMethod;
  if (id === 'sort') delete next.sort;
  if (id === 'limit') delete next.limit;
  if (id === 'aggregate') delete next.aggregate;
  if (!next.entities.length) next.entities = ['expense'];
  return { ...next, interpretation: buildInterpretation(next) };
}

export function editChip(spec: QuerySpec, id: string, value: string): QuerySpec {
  const next = structuredClone(spec) as QuerySpec;
  const list = value.split(',').map((item) => item.trim()).filter(Boolean);
  if (id === 'category') next.filters.category = list;
  else if (id === 'vendor') next.filters.vendor = list;
  else if (id === 'customer') next.filters.customer = list;
  else if (id === 'account') next.filters.account = list;
  else if (id === 'source') next.filters.source = list as NonNullable<QuerySpec['filters']['source']>;
  else if (id === 'status') next.filters.status = list as NonNullable<QuerySpec['filters']['status']>;
  else if (id === 'method') next.filters.paymentMethod = list;
  else if (id === 'text') next.filters.text = value.trim() || undefined;
  else if (id === 'date') { const [from, to] = value.split(',').map((item) => item.trim()); if (from && to) next.filters.dateRange = { ...next.filters.dateRange, from, to, label: `${from}–${to}` }; }
  else if (id === 'amount') { const [min, max] = value.split(',').map((item) => item.trim()); const parsed = { min: min ? Number(min) : undefined, max: max ? Number(max) : undefined }; next.filters.amount = parsed; }
  else if (id === 'sort') { const [field, dir] = value.split(':'); if (field && ['date', 'amount', 'dueDate'].includes(field) && (dir === 'asc' || dir === 'desc')) next.sort = { field: field as NonNullable<QuerySpec['sort']>['field'], dir }; }
  else if (id === 'limit') { const parsed = Number(value); if (Number.isInteger(parsed)) next.limit = parsed; }
  else if (id === 'aggregate' && ['sum', 'count', 'avg', 'max', 'min'].includes(value)) next.aggregate = value as NonNullable<QuerySpec['aggregate']>;
  return querySpecSchema.parse({ ...next, interpretation: buildInterpretation(next) });
}

const plural = (entity: EntityKind) => entity === 'expense' ? 'expenses' : entity === 'invoice' ? 'invoices' : entity === 'transaction' ? 'transactions' : entity === 'account' ? 'accounts' : 'customers';
/** One-sentence summary of a spec; regenerated whenever chips are removed or edited so it never goes stale. */
export function buildInterpretation(spec: QuerySpec): string {
  const f = spec.filters;
  const amount = f.amount ? `${f.amount.min !== undefined ? `≥ ₹${f.amount.min.toLocaleString('en-IN')}` : ''}${f.amount.min !== undefined && f.amount.max !== undefined ? ' · ' : ''}${f.amount.max !== undefined ? `≤ ₹${f.amount.max.toLocaleString('en-IN')}` : ''}` : undefined;
  return [spec.entities.map(plural).join(' + '), f.category?.join(', '), f.vendor?.join(', '), f.customer?.join(', '), f.status?.join(' + '), f.dateRange?.label, amount].filter(Boolean).join(' · ') || 'matching financial records';
}

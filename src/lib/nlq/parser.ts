import { isInScope, parsePeriod, type Workspace } from '@/lib/assistant/engine';
import { norm } from '@/lib/assistant/text';
import { parseAmount } from './amount';
import { buildInterpretation } from './describe';
import { intent, isGenericWord, offTopic, status as statusLex, writeIntent } from './lexicon';
import { resolveEntity, type Match } from './entities';
import { querySpecSchema, type QuerySpec } from './types';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasAny = (text: string, list: readonly string[]) => new RegExp(`\\b(?:${list.map(esc).join('|')})\\b`).test(text);
const words = (s: string) => norm(s).split(/\s+/).filter(Boolean);
const monthWords = /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\b/i;
const scopeWords = /\b(spent|spend|spending|invoices?|expenses?|payments?|pay|bills?|transactions?|accounts?|ledger|balances?|overdue|unpaid|pending|paid|draft|owe|customers?|vendors?|kharcha|bhugtan|baaki|everything about|journal|entries|received|cash|gst|marketing|travel|rent|software)\b/i;

const dateField = (text: string): 'date' | 'dueDate' => (/\b(due|overdue|past due)\b/.test(text) ? 'dueDate' : 'date');

function entityKind(text: string) {
  for (const [kind, values] of Object.entries(intent)) if (hasAny(text, values)) return kind as 'expense' | 'invoice' | 'transaction' | 'account';
  return undefined;
}

export function isWriteIntentQuestion(question: string) { return writeIntent.test(norm(question)); }

export function isNlqInScope(question: string, ws?: Workspace) {
  const text = norm(question);
  if (!text || offTopic.test(text)) return false;
  return (ws ? isInScope(question, ws) : isInScope(question)) || scopeWords.test(text) || /\bq[1-4]\b|₹/.test(question.toLowerCase()) || monthWords.test(text) || /\b(last|this|during|since|between)\s+(?:\d+\s+)?(month|week|quarter|year|fy|days|financial)/.test(text);
}

export type ParseResult = { spec?: QuerySpec; confidence: number; unresolved: string[]; refusal?: string; alternatives: string[] };

export function parseQuestion(question: string, ws: Workspace, now: string): ParseResult {
  const raw = question.trim();
  const text = norm(raw);
  const empty = { confidence: 0, unresolved: [], alternatives: [] as string[] };
  if (!text) return { ...empty, refusal: 'Tell me what records you want to find.' };
  if (writeIntent.test(text)) return { ...empty, refusal: 'Search is read-only. Open the relevant Finova module to make that change.' };
  if (!isNlqInScope(raw, ws)) return { ...empty, refusal: 'I can help find Finova records such as expenses, invoices, payments, journal entries, and accounts.' };

  const period = parsePeriod(text, now);
  const amount = parseAmount(text);
  const statuses: string[] = [];
  for (const [name, values] of Object.entries(statusLex)) if (hasAny(text, values)) statuses.push(name);
  if (/\b(unpaid|outstanding|open|baaki)\b/.test(text)) for (const s of ['Pending', 'Overdue']) if (!statuses.includes(s)) statuses.push(s);

  let kind = entityKind(text);
  if (!kind && /\b(customers?|overdue|unpaid|pending|due|draft)\b/.test(text)) kind = 'invoice';
  let entities: QuerySpec['entities'] = kind ? [kind] : ['expense'];
  const filters: QuerySpec['filters'] = {};
  const alternatives: string[] = [];
  const resolved: string[] = [];
  const candidates = words(text).filter((w) => w.length > 2 && !/^\d/.test(w) && !isGenericWord(w));

  if (/\b(everything about|all about|360)\b/.test(text)) {
    entities = ['invoice', 'transaction', 'expense'];
    const subject = candidates[0];
    if (subject) { filters.text = subject; resolved.push(subject); }
  } else if (kind === 'expense' && /\b(everything|spent|spending)\b/.test(text)) entities = ['expense', 'transaction'];

  if (statuses.length) filters.status = [...new Set(statuses)] as QuerySpec['filters']['status'];
  else if (kind === 'invoice' && /\bdue\b/.test(text) && true) filters.status = ['Pending', 'Overdue'];
  if (period?.from && period.to) filters.dateRange = { from: period.from, to: period.to, label: period.label, field: dateField(text) };
  if (amount.filter) filters.amount = amount.filter;

  const ok = (m?: Match) => (m && m.score >= 0.67 ? m : undefined);
  const vendorCue = /\b(pay|paid to|vendor|supplier|bought from|from)\b/.test(text);
  const categoryCue = /\b(category|spent on|spend on|spending on|on)\b/.test(text);

  if (kind === 'invoice' || kind === 'transaction') {
    for (const candidate of candidates) {
      const match = ok(resolveEntity(candidate, 'customer', ws));
      if (match) { filters.customer = [match.value]; resolved.push(candidate); alternatives.push(...match.alternatives); break; }
    }
  }
  if (kind === 'expense' || (!kind && entities[0] === 'expense')) {
    for (const candidate of candidates) {
      const cat = ok(resolveEntity(candidate, 'category', ws));
      const ven = ok(resolveEntity(candidate, 'vendor', ws));
      if (!cat && !ven) continue;
      let pick = (cat ?? ven) as Match;
      if (cat && ven) {
        const preferVendor = vendorCue && !categoryCue ? true : categoryCue && !vendorCue ? false : ven.score > cat.score;
        pick = preferVendor ? ven : cat;
        const other = preferVendor ? cat : ven;
        alternatives.push(`${other.kind === 'vendor' ? 'Vendor' : 'Category'}: ${other.value}`);
      }
      if (pick.kind === 'vendor') filters.vendor = [pick.value]; else filters.category = [pick.value];
      resolved.push(candidate); alternatives.push(...pick.alternatives);
      break;
    }
    if (/\b(cash expenses?|paid in cash|in cash|by cash|cash payments?)\b/.test(text)) { filters.paymentMethod = ['Cash']; resolved.push('cash'); }
  }
  if (kind === 'account') {
    for (const candidate of candidates) {
      const match = ok(resolveEntity(candidate, 'account', ws));
      if (match) { filters.account = [ws.accounts.find((a) => a.name === match.value)?.id ?? match.value]; resolved.push(candidate); alternatives.push(...match.alternatives); break; }
    }
  }
  if (/\bgst\b/.test(text)) { filters.text = 'gst'; resolved.push('gst'); }
  if (/\bbank transactions?\b/.test(text) && !filters.account) { const bank = ws.accounts.find((a) => /bank/i.test(a.name)); if (bank) { filters.account = [bank.id]; resolved.push('bank'); } }
  if (/\bmanual journal entries?\b/.test(text)) filters.source = ['MANUAL'];
  else if (/\binvoice entries?\b/.test(text)) filters.source = ['INVOICE'];
  else if (/\bexpense entries?\b/.test(text)) filters.source = ['EXPENSE'];
  if (/\b(payments? received|received payments?)\b/.test(text)) { entities = ['transaction']; filters.source = ['PAYMENT']; }

  let sort: QuerySpec['sort'];
  if (/\b(largest|biggest|highest)\b/.test(text)) sort = { field: 'amount', dir: 'desc' };
  else if (/\b(smallest|lowest)\b/.test(text)) sort = { field: 'amount', dir: 'asc' };
  else if (/\b(latest|recent|newest)\b/.test(text)) sort = { field: 'date', dir: 'desc' };
  else if (/\boldest\b/.test(text)) sort = { field: 'date', dir: 'asc' };
  const n = text.match(/\b(?:top|largest|biggest|highest|smallest|lowest|first|latest|oldest)\s+(\d{1,3})\b/);
  const limit = n?.[1] ? Math.max(1, Math.min(100, Number(n[1]))) : /\b(largest|biggest)\b/.test(text) ? 5 : undefined;
  const aggregate: QuerySpec['aggregate'] = /\b(how much|total|spent|spending)\b/.test(text) ? 'sum' : /\b(how many|count)\b/.test(text) ? 'count' : undefined;

  for (const v of [...(filters.customer ?? []), ...(filters.vendor ?? []), ...(filters.category ?? [])]) for (const c of candidates) if (norm(v).split(' ').includes(c)) resolved.push(c);
  const unresolved = candidates.filter((c) => !resolved.includes(c) && c.length > 3);
  const consumed = (kind ? 1 : 0) + (period ? 1 : 0) + (amount.filter ? 1 : 0) + (statuses.length ? 1 : 0) + (resolved.length ? 1 : 0) + (sort || limit ? 1 : 0) + (filters.paymentMethod || filters.source ? 1 : 0);
  const base = Math.max(0, Math.min(1, 0.28 + 0.14 * consumed + (resolved.length ? 0.12 : 0) - Math.min(0.25, unresolved.length * 0.04)));
  const confidence = kind && !unresolved.length ? Math.max(base, 0.5) : base;
  const draft = { entities, filters, sort, limit, aggregate, confidence, unresolved, interpretation: '', source: 'rules' as const };
  const spec = querySpecSchema.parse({ ...draft, interpretation: buildInterpretation(draft as QuerySpec) });
  return { spec, confidence, unresolved, alternatives: [...new Set(alternatives)].slice(0, 3) };
}

import { parsePeriod } from '@/lib/assistant/engine';
import { norm } from '@/lib/assistant/text';
import { buildInterpretation } from './describe';
import type { QuerySpec } from './types';

export type NlqContext = { spec: QuerySpec; at: number };
const entityWord = /\b(invoices?|expenses?|payments?|transactions?|entries|accounts?|spent|spending|bills?|customers?)\b/;

/** True only for short refinements ("only the paid ones", "what about October?"); fresh questions must never be merged into old context. */
export function isFollowUp(question: string, now = '2026-10-02'): boolean {
  const t = norm(question);
  if (!t) return false;
  if (/^(what about|how about|and|also|only|just|same|make it|now|sort|order|by)\b/.test(t)) return true;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length <= 4 && !entityWord.test(t) && (/\b(paid|unpaid|pending|overdue|draft|largest|biggest|smallest|latest|oldest)\b/.test(t) || !!parsePeriod(t, now)?.from);
}

export function mergeFollowUp(previous: QuerySpec, followUp: string, now = '2026-10-02'): QuerySpec {
  const spec = structuredClone(previous) as QuerySpec;
  const text = norm(followUp);
  if (/\b(unpaid|pending|outstanding)\b/.test(text)) spec.filters.status = ['Pending', 'Overdue'];
  else if (/\boverdue\b/.test(text)) spec.filters.status = ['Overdue'];
  else if (/\bdraft\b/.test(text)) spec.filters.status = ['Draft'];
  else if (/\bpaid\b/.test(text)) spec.filters.status = ['Paid'];
  const period = parsePeriod(text, now);
  if (period?.from && period.to) spec.filters.dateRange = { from: period.from, to: period.to, label: period.label, field: spec.filters.dateRange?.field };
  if (/\b(sort by amount|largest|biggest|highest)\b/.test(text)) spec.sort = { field: 'amount', dir: 'desc' };
  else if (/\b(smallest|lowest)\b/.test(text)) spec.sort = { field: 'amount', dir: 'asc' };
  else if (/\b(latest|recent|newest)\b/.test(text)) spec.sort = { field: 'date', dir: 'desc' };
  spec.interpretation = buildInterpretation(spec);
  return spec;
}
export function isContextFresh(context: NlqContext | undefined, now = Date.now()) { return !!context && now - context.at <= 300_000; }

import type { Account } from '@/lib/data/types';
import type { Workspace } from './engine';

export const norm = (s: string) => s.toLowerCase().replace(/₹|\brs\.?(?=\s|\d)|\binr\b/g, ' ').replace(/[^a-z0-9&\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
export const stem = (w: string) => {
  if (w.length <= 3) return w;
  if (w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (/(sses|xes|ches|shes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1);
  return w;
};

export function dataVocabulary(ws: Workspace): Set<string> {
  const v = new Set<string>();
  const addAll = (s: string) => norm(s).split(' ').forEach((t) => { if (t.length > 2) v.add(stem(t)); });
  ws.accounts.forEach((a: Account) => addAll(a.name));
  ws.invoices.forEach((i) => { addAll(i.customer); addAll(i.number); });
  ws.expenses.forEach((e) => { addAll(e.vendor); addAll(e.category); addAll(e.id); });
  ws.entries.forEach((e) => addAll(e.reference));
  return v;
}

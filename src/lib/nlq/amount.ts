import { r2 } from '@/lib/data/format';

const unit = (s: string) => { const x = s.toLowerCase(); if (x === 'cr' || x === 'crore' || x === 'crores') return 10_000_000; if (x === 'l' || x === 'lac' || x === 'lakh' || x === 'lakhs') return 100_000; if (x === 'k' || x === 'thousand') return 1_000; return 1; };
export function parseIndianAmount(raw: string): number | undefined {
  const clean = raw.toLowerCase().replace(/₹|rs\.?|inr/g, '').replace(/,/g, '').trim();
  const m = clean.match(/^([0-9]+(?:\.[0-9]+)?)\s*(cr|crore|crores|l|lac|lakh|lakhs|k|thousand)?$/);
  if (!m) return undefined; const n = Number(m[1]); if (!Number.isFinite(n)) return undefined; return r2(n * unit(m[2] ?? ''));
}
export type AmountFilter = { min?: number; max?: number };
export function parseAmount(text: string): { filter?: AmountFilter; consumed: string[] } {
  const t = text.toLowerCase(); const consumed: string[] = []; let filter: AmountFilter | undefined;
  const token = '(?:₹|rs\\.?|inr)?\\s*\\d[\\d,]*(?:\\.\\d+)?\\s*(?:cr(?:ore)?s?|l(?:ac|akh)?s?|k|thousand)?';
  const range = new RegExp(`\\bbetween\\s+(${token})\\s+and\\s+(${token})\\b`, 'i').exec(t);
  if (range) { const a = parseIndianAmount(range[1] ?? ''); const b = parseIndianAmount(range[2] ?? ''); if (a !== undefined && b !== undefined) { filter = { min: Math.min(a,b), max: Math.max(a,b) }; consumed.push(range[0]); return { filter, consumed }; } }
  const hinglish = new RegExp(`(${token})\\s+(?:se\\s+)?(zyada|adhik)`, 'i').exec(t);
  if (hinglish) { const n = parseIndianAmount(hinglish[1] ?? ''); if (n !== undefined) return { filter: { min: n }, consumed: [hinglish[0]] }; }
  const hinglishMax = new RegExp(`(${token})\\s+(?:se\\s+)?kam`, 'i').exec(t);
  if (hinglishMax) { const n = parseIndianAmount(hinglishMax[1] ?? ''); if (n !== undefined) return { filter: { max: n }, consumed: [hinglishMax[0]] }; }
  const comparators: [RegExp, 'min' | 'max'][] = [[new RegExp(`(?:over|above|more than|greater than|at least|>=|se zyada|zyada|adhik)\\s*(${token})`, 'i'), 'min'], [new RegExp(`(?:under|below|less than|at most|<=|se kam|kam)\\s*(${token})`, 'i'), 'max']];
  for (const [re, side] of comparators) { const m = re.exec(t); if (m) { const n = parseIndianAmount(m[1] ?? ''); if (n !== undefined) { filter = { [side]: n }; consumed.push(m[0]); return { filter, consumed }; } } }
  const around = new RegExp(`(?:around|about)\\s*(${token})`, 'i').exec(t); if (around) { const n = parseIndianAmount(around[1] ?? ''); if (n !== undefined) { filter = { min: r2(n * .9), max: r2(n * 1.1) }; consumed.push(around[0]); return { filter, consumed }; } }
  return { consumed };
}

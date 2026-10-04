import type { Line } from './types';

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MON = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
const PATTERNS: Array<{ re: RegExp; kind: 'iso' | 'dmy' | 'dMonY' | 'MonDY' }> = [
  { re: /(?<![\d])(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?![\d])/g, kind: 'iso' },
  { re: /(?<![\d])(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?![\d])/g, kind: 'dmy' },
  { re: new RegExp(`(?<![\\d])(\\d{1,2})(?:st|nd|rd|th)?[\\s,\\-]+${MON}[\\s,\\-]+(\\d{4}|\\d{2})(?![\\d])`, 'gi'), kind: 'dMonY' },
  { re: new RegExp(`${MON}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})(?![\\d])`, 'gi'), kind: 'MonDY' },
];

function year(y: string) { const n = Number(y); return n < 100 ? 2000 + n : n; }
function valid(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export type DateHit = { iso: string; ambiguous: boolean; start: number };

export function datesInLine(line: string): DateHit[] {
  const hits: DateHit[] = [];
  for (const { re, kind } of PATTERNS) {
    for (const m of line.matchAll(re)) {
      const start = m.index ?? 0;
      let y = 0, mo = 0, d = 0, ambiguous = false;
      if (kind === 'iso') { y = Number(m[1]); mo = Number(m[2]); d = Number(m[3]); }
      else if (kind === 'dmy') {
        const a = Number(m[1]); const b = Number(m[2]); y = year(m[3] ?? '');
        if (a > 12) { d = a; mo = b; } else if (b > 12) { mo = a; d = b; } else { d = a; mo = b; ambiguous = a !== b; } // Indian default: day first
      } else if (kind === 'dMonY') { d = Number(m[1]); mo = MONTHS[(m[2] ?? '').slice(0, 3).toLowerCase()] ?? 0; y = year(m[3] ?? ''); }
      else { mo = MONTHS[(m[1] ?? '').slice(0, 3).toLowerCase()] ?? 0; d = Number(m[2]); y = year(m[3] ?? ''); }
      if (valid(y, mo, d) && !hits.some((h) => Math.abs(h.start - start) < 3)) hits.push({ iso: iso(y, mo, d), ambiguous, start });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

const POSITIVE: Array<[RegExp, number]> = [
  [/invoice\s*date|bill\s*date|date\s*of\s*(?:issue|invoice|bill)|issue\s*date|issued(?:\s*on)?/i, 10],
  [/(?:txn|transaction|payment|paid)\s*(?:date|on)|date\s*&?\s*time|order\s*date|purchase\s*date/i, 8],
  [/\bdate\b|\bdt\b|\bon\b/i, 5],
];
const NEGATIVE = /due\s*date|due\s*on|valid\s*(?:till|until|upto)|expir|\bdob\b|delivery|deliver(?:ed)?\s*by|period|\bfrom\b|\bto\b|next\s*due|renew|check[-\s]*(?:in|out)|travel\s*date|journey|dispatch/i;

export type PickedDate = { iso: string; confidence: number; reason: string; ambiguous: boolean };

/** Chooses the document's *issue* date: labelled "invoice date" beats a bare date, and "due date" is never chosen when anything else exists. */
export function pickDate(lines: Line[]): PickedDate | null {
  type Cand = PickedDate & { score: number };
  const cands: Cand[] = [];
  for (const line of lines) {
    for (const hit of datesInLine(line.text)) {
      const before = line.text.slice(0, hit.start);
      let score = 2 - Math.min(line.index, 40) * 0.02;
      let label = 'unlabelled date';
      for (const [re, w] of POSITIVE) { if (re.test(before.slice(-40))) { score += w; label = before.slice(-40).trim() || label; break; } }
      const neg = NEGATIVE.test(before.slice(-30));
      if (neg) { score -= 9; label = `${before.slice(-30).trim()} (not the issue date)`; }
      if (line.role === 'recipient') score -= 2;
      let confidence = neg ? 0.45 : score >= 10 ? 0.97 : score >= 6 ? 0.9 : 0.72;
      if (hit.ambiguous) confidence -= 0.08;
      cands.push({ iso: hit.iso, confidence, reason: `"${label.slice(-40)}" on line ${line.index + 1}`, ambiguous: hit.ambiguous, score });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  return cands[0] ?? null;
}

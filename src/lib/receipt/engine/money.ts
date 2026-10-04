import { parseIndianAmountToPaise } from '../money';

export type MoneyTok = { paise: bigint; strong: boolean; negative: boolean; start: number; end: number; raw: string };

const MONEY_RE = /(?<![\w@.\/])(-\s*)?(?:(₹|rs\.?|inr)\s*(-\s*)?)?(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![\w@\/])/gi;

/** All money-looking numbers in a line. "strong" = has a currency marker, decimals or digit grouping. */
export function moneyTokens(line: string): MoneyTok[] {
  const out: MoneyTok[] = [];
  for (const m of line.matchAll(MONEY_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const digits = m[4] ?? '';
    const hasCurrency = Boolean(m[2]);
    const strong = hasCurrency || digits.includes('.') || digits.includes(',');
    const after = line.slice(end).trimStart();
    if (after.startsWith('%')) continue; // a rate, not an amount
    const prev = line[start - 1] ?? '';
    const next = line[end] ?? '';
    if (!strong && (prev === '-' || prev === '/' || next === '-' || next === '/' || prev === '#')) continue; // ids / dates
    const paise = parseIndianAmountToPaise(digits);
    if (paise === null) continue;
    const negative = Boolean(m[1] || m[3]) || (prev === '(' && next === ')');
    out.push({ paise: negative ? -paise : paise, strong, negative, start, end, raw: m[0] });
  }
  return out;
}

export function lastAmount(line: string, allowBare = true): MoneyTok | null {
  const toks = moneyTokens(line);
  const strong = toks.filter((t) => t.strong);
  if (strong.length) return strong[strong.length - 1] ?? null;
  return allowBare ? (toks[toks.length - 1] ?? null) : null;
}

export function abs(v: bigint) { return v < 0n ? -v : v; }
export function fmt(p: bigint) { const a = abs(p); return `${p < 0n ? '-' : ''}${(a / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${(a % 100n).toString().padStart(2, '0')}`; }

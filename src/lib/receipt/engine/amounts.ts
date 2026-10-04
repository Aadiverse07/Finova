import { abs, fmt, lastAmount, moneyTokens } from './money';
import type { Line } from './types';

export type Kind = 'total' | 'subtotal' | 'tax' | 'discount' | 'tip' | 'roundoff';
export type TaxType = 'CGST' | 'SGST' | 'IGST' | 'CESS' | 'OTHER';
export type Cand = { kind: Kind; paise: bigint; priority: number; line: number; text: string; taxType?: TaxType; rate: number | null };

const TOTAL_RULES: Array<[RegExp, number]> = [
  [/grand\s*total/i, 100],
  [/(?:total|net|balance|amount)\s*(?:amount\s*)?(?:due|payable)|payable\s*amount|net\s*payable|amount\s*to\s*pay/i, 95],
  [/(?:invoice|bill|order|final|sale)\s*(?:total|amount|value)/i, 90],
  [/\btotal\s*amount\b|\bnet\s*amount\b|\btotal\s*value\b|\btotal\s*\(?(?:inr|rs|incl)/i, 85],
  [/\bamount\s*paid\b|\bpaid\s*amount\b|\btotal\s*paid\b|\bpaid\b(?=\s*(?:₹|rs|inr|\d))/i, 80],
  [/\btotal\b/i, 70],
  [/^\W*amount\b/i, 50],
];
const SKIP = /total\s*(?:qty|quantity|items?|units?|savings?|weight|pcs|pieces)\b|\bmrp\b|you\s*saved|savings/i;
const LEAD = /^[\s:.\-+()]*(?:add|less|plus|minus|incl\.?|excl\.?)?[\s:.\-+()]*/i;

export function classify(line: string): { kind: Kind; priority: number; taxType?: TaxType; rate: number | null } | null {
  if (SKIP.test(line)) return null;
  const body = line.replace(LEAD, '');
  const rate = /(\d{1,2}(?:\.\d+)?)\s*%/.exec(line);
  const r = rate ? Number(rate[1]) : null;
  if (/^(?:round(?:ing)?[\s-]*off|rounding|roundoff)/i.test(body)) return { kind: 'roundoff', priority: 1, rate: null };
  if (/^(?:total\s*)?(?:tax|gst|cgst|sgst|igst|utgst|cess|vat)\b(?!\s*invoice)/i.test(body) && !/^total\s*(?:amount|due|payable)/i.test(body)) {
    const t = /\b(cgst|sgst|utgst|igst|cess)\b/i.exec(body)?.[1]?.toUpperCase();
    const taxType: TaxType = t === 'UTGST' ? 'SGST' : (t as TaxType | undefined) ?? 'OTHER';
    return { kind: 'tax', priority: taxType === 'OTHER' ? 1 : 2, taxType, rate: r };
  }
  if (/^(?:total\s*)?(?:discount|rebate|coupon|promo)/i.test(body)) return { kind: 'discount', priority: 1, rate: null };
  if (/^(?:sub\s*-?\s*total|taxable\s*(?:value|amount)|amount\s*before\s*tax|total\s*before\s*tax|basic\s*(?:amount|value)|gross\s*amount|net\s*taxable)/i.test(body)) return { kind: 'subtotal', priority: /taxable/i.test(body) ? 2 : 1, rate: null };
  if (/^(?:tip|gratuity|service\s*charges?|packaging|delivery|convenience|handling|shipping)\b/i.test(body)) return { kind: 'tip', priority: 1, rate: null };
  for (const [re, p] of TOTAL_RULES) if (re.test(body.slice(0, 40))) return { kind: 'total', priority: p, rate: null };
  return null;
}

export type ItemRow = { description: string; quantity: number | null; ratePaise: bigint | null; amountPaise: bigint; confidence: number; lineIndex: number };

const NOT_ITEM = /gstin|invoice|date|phone|mobile|email|address|thank|www\.|http|bill(?:ed)?\s*to|ship\s*to|status|notes?|terms|payment|due\b|upi|utr|pan\b|round|cash|change|tendered/i;

/** Rows of the item table: "<description> <qty> <rate> <amount>". */
export function parseItems(lines: Line[], vendorLine: number): { items: ItemRow[]; summaryStart: number } {
  const headerIdx = lines.findIndex((l) => /^(?:description|item|particulars|product)\b/i.test(l.text) && /\b(?:qty|quantity|amount|rate|price)\b/i.test(l.text));
  const items: ItemRow[] = [];
  let summaryStart = lines.length;
  for (let i = headerIdx + 1; i < lines.length; i += 1) {
    const l = lines[i];
    if (!l) continue;
    const toks = moneyTokens(l.text).filter((t) => t.strong);
    const cls = classify(l.text);
    if (cls && toks.length <= 1 && !(headerIdx >= 0 && toks.length >= 2)) { summaryStart = Math.min(summaryStart, i); if (headerIdx >= 0) break; continue; }
    if (headerIdx < 0 && (i <= vendorLine || l.role !== 'issuer' && l.role !== 'neutral')) continue;
    if (!toks.length || NOT_ITEM.test(l.text)) continue;
    if (headerIdx < 0 && cls) continue;
    const first = toks[0]; const lastTok = toks[toks.length - 1];
    if (!first || !lastTok) continue;
    const before = l.text.slice(0, first.start).trim();
    const qtyMatch = /(?:^|\s)(\d+(?:\.\d+)?)\s*(?:x|pcs?|nos?|units?|kg|g|l|ltr)?\s*$/i.exec(before);
    const description = (qtyMatch ? before.slice(0, qtyMatch.index) : before).replace(/^\d+[.)]\s*/, '').trim();
    if (description.length < 2 || !/[A-Za-z\u0900-\u097F]{2}/.test(description)) continue;
    if (/^(?:rate|price|mrp|qty|quantity|amount|total|net|gross|cgst|sgst|igst|gst|tax|balance|paid|change|round(?:ing)?|saving|you\s*saved)\b/i.test(description)) continue;
    const quantity = qtyMatch ? Number(qtyMatch[1]) : null;
    const ratePaise = toks.length >= 2 ? first.paise : null;
    const amountPaise = abs(lastTok.paise);
    const consistent = quantity !== null && ratePaise !== null && BigInt(Math.round(quantity * 100)) * ratePaise === amountPaise * 100n;
    items.push({ description, quantity, ratePaise, amountPaise, confidence: consistent ? 0.93 : headerIdx >= 0 ? 0.78 : 0.55, lineIndex: i });
  }
  return { items: items.slice(0, 30), summaryStart };
}

export type AmountDecision = {
  totalPaise: bigint; subtotalPaise: bigint | null; taxLines: Array<{ type: TaxType; rate: number | null; amountPaise: bigint }>; taxPaise: bigint;
  discountPaise: bigint | null; tipPaise: bigint | null; roundOffPaise: bigint | null;
  confidence: { total: number; subtotal: number; tax: number; discount: number; tip: number; roundOff: number };
  reconciled: 'exact' | 'rounding' | 'inclusive' | 'none'; notes: string[]; totalLine: number | null;
};

function sum(xs: bigint[]) { return xs.reduce((s, x) => s + x, 0n); }
function uniqueBy<T>(xs: T[], key: (x: T) => string) { const seen = new Set<string>(); return xs.filter((x) => (seen.has(key(x)) ? false : (seen.add(key(x)), true))); }

export function decideAmounts(lines: Line[], items: ItemRow[], rawText: string): AmountDecision {
  const cands: Cand[] = [];
  const itemLines = new Set(items.map((i) => i.lineIndex));
  for (const l of lines) {
    if (itemLines.has(l.index) || l.role === 'recipient') continue;
    const cls = classify(l.text);
    if (!cls) continue;
    const toks = moneyTokens(l.text);
    const strong = toks.filter((t) => t.strong);
    if (strong.length > 2 && cls.kind !== 'total') continue; // a table row, not a summary line
    const tok = lastAmount(l.text, true);
    if (!tok) continue;
    let paise = tok.paise;
    if (cls.kind === 'discount' || cls.kind === 'tax') paise = abs(paise);
    if (cls.kind === 'total' && paise <= 0n) continue;
    cands.push({ kind: cls.kind, paise, priority: cls.priority, line: l.index, text: l.text, ...(cls.taxType ? { taxType: cls.taxType } : {}), rate: cls.rate });
  }
  const notes: string[] = [];
  const by = (k: Kind) => cands.filter((c) => c.kind === k);

  const totals = uniqueBy(by('total').sort((a, b) => b.priority - a.priority || b.line - a.line), (c) => c.paise.toString()).slice(0, 4);
  const itemSum = sum(items.map((i) => i.amountPaise));
  const labelledSubs: bigint[] = uniqueBy(by('subtotal').sort((a, b) => b.priority - a.priority || b.line - a.line), (c) => c.paise.toString()).map((c) => c.paise);
  const subs: Array<bigint | null> = [...labelledSubs];
  if (itemSum > 0n && !subs.some((s) => s === itemSum)) subs.push(itemSum);
  subs.push(null);

  const taxCands = by('tax');
  const comps = (['CGST', 'SGST', 'IGST', 'CESS'] as const).flatMap((t) => { const c = taxCands.filter((x) => x.taxType === t).sort((a, b) => b.line - a.line)[0]; return c ? [c] : []; });
  const aggregate = taxCands.filter((x) => x.taxType === 'OTHER').sort((a, b) => b.line - a.line)[0];
  const taxOptions: Cand[][] = [];
  if (comps.length) taxOptions.push(comps);
  if (aggregate) taxOptions.push([aggregate]);
  if (comps.length && aggregate) taxOptions.push([...comps, aggregate]);
  taxOptions.push([]);

  const latest = (k: Kind) => by(k).sort((a, b) => b.line - a.line)[0];
  const disc = latest('discount'); const tip = latest('tip'); const rnd = latest('roundoff');
  const discOpts = disc ? [disc.paise, 0n] : [0n];
  const tipOpts = tip ? [tip.paise, 0n] : [0n];
  const rndOpts = rnd ? [rnd.paise, -rnd.paise, 0n] : [0n];

  type Pick = { total: Cand; sub: bigint | null; tax: Cand[]; disc: bigint; tip: bigint; rnd: bigint; diff: bigint };
  let exact = null as Pick | null; let near = null as Pick | null;
  for (const total of totals) for (const sub of subs) {
    if (sub === null) continue;
    for (const tax of taxOptions) for (const d of discOpts) for (const t of tipOpts) for (const r of rndOpts) {
      const diff = abs(sub + sum(tax.map((x) => x.paise)) - d + t + r - total.paise);
      const pick = { total, sub, tax, disc: d, tip: t, rnd: r, diff };
      if (diff === 0n && !exact) exact = pick;
      else if (diff <= 99n && (!near || diff < near.diff)) near = pick;
    }
    if (exact) break;
  }

  const primaryTotal = totals[0];
  const mention = /incl(?:usive|\.|uding)?\s*(?:of\s*)?(?:all\s*)?(?:gst|tax|taxes)|inclusive\s*of/i.test(rawText);
  let decision: AmountDecision;
  const conf = { total: 0.2, subtotal: 0.2, tax: 0.2, discount: 0.25, tip: 0.25, roundOff: 0.2 };
  const toLines = (taxes: Cand[]) => taxes.map((x) => ({ type: x.taxType ?? 'OTHER' as TaxType, rate: x.rate, amountPaise: x.paise }));

  const finish = (p: Pick, mode: 'exact' | 'rounding') => {
    const taxes = toLines(p.tax);
    const roundOff = mode === 'rounding' ? p.total.paise - (p.sub ?? 0n) - sum(p.tax.map((x) => x.paise)) + p.disc - p.tip : (rnd ? p.rnd : null);
    notes.push(mode === 'exact' ? `Arithmetic reconciles: ${fmt(p.sub ?? 0n)} + tax ${fmt(sum(p.tax.map((x) => x.paise)))} - discount ${fmt(p.disc)} = ${fmt(p.total.paise)}.` : `Arithmetic reconciles within rounding (${fmt(p.diff)}).`);
    const c = mode === 'exact' ? 0.98 : 0.92;
    return { totalPaise: p.total.paise, subtotalPaise: p.sub, taxLines: taxes, taxPaise: sum(p.tax.map((x) => x.paise)), discountPaise: disc ? p.disc : null, tipPaise: tip ? p.tip : null, roundOffPaise: roundOff !== null && roundOff !== 0n ? roundOff : rnd ? 0n : null, confidence: { total: c, subtotal: c, tax: taxes.length ? c : 0.6, discount: disc ? c : 0.5, tip: tip ? 0.9 : 0.5, roundOff: roundOff !== null && roundOff !== 0n ? (mode === 'rounding' ? 0.7 : 0.9) : 0.5 }, reconciled: mode, notes, totalLine: p.total.line } satisfies AmountDecision;
  };

  const printedTax = aggregate ? [aggregate] : comps;
  const inclusiveHit = mention && printedTax.length > 0 ? totals.find((t) => subs.some((s) => s !== null && s === t.paise)) : undefined;
  if (inclusiveHit && (!exact || exact.tax.length === 0)) {
    notes.push('Tax is printed as included in the total, so subtotal equals total.');
    decision = { totalPaise: inclusiveHit.paise, subtotalPaise: inclusiveHit.paise, taxLines: toLines(printedTax), taxPaise: sum(printedTax.map((x) => x.paise)), discountPaise: disc?.paise ?? null, tipPaise: tip?.paise ?? null, roundOffPaise: rnd?.paise ?? null, confidence: { ...conf, total: 0.92, subtotal: 0.85, tax: 0.85 }, reconciled: 'inclusive', notes, totalLine: inclusiveHit.line };
  } else if (exact) decision = finish(exact, 'exact');
  else if (near) decision = finish(near, 'rounding');
  else if (primaryTotal) {
    const sub = labelledSubs[0] ?? null;
    const taxes = aggregate ? [aggregate] : comps;
    const taxSum = sum(taxes.map((x) => x.paise));
    if (mention && sub !== null && sub === primaryTotal.paise && taxSum > 0n) {
      notes.push('Tax is printed as included in the total, so subtotal equals total.');
      decision = { totalPaise: primaryTotal.paise, subtotalPaise: sub, taxLines: toLines(taxes), taxPaise: taxSum, discountPaise: disc?.paise ?? null, tipPaise: tip?.paise ?? null, roundOffPaise: rnd?.paise ?? null, confidence: { ...conf, total: 0.9, subtotal: 0.85, tax: 0.85 }, reconciled: 'inclusive', notes, totalLine: primaryTotal.line };
    } else {
      notes.push(`Labelled total "${primaryTotal.text.slice(0, 40)}" kept, but the parts do not add up to it.`);
      decision = { totalPaise: primaryTotal.paise, subtotalPaise: sub, taxLines: toLines(taxes), taxPaise: taxSum, discountPaise: disc?.paise ?? null, tipPaise: tip?.paise ?? null, roundOffPaise: rnd?.paise ?? null, confidence: { total: primaryTotal.priority >= 85 ? 0.8 : 0.7, subtotal: sub === null ? 0.2 : 0.6, tax: taxes.length ? 0.6 : 0.3, discount: disc ? 0.6 : 0.4, tip: tip ? 0.6 : 0.4, roundOff: rnd ? 0.6 : 0.3 }, reconciled: 'none', notes, totalLine: primaryTotal.line };
    }
  } else {
    const sub = labelledSubs[0] ?? null;
    const taxes = aggregate ? [aggregate] : comps; const taxSum = sum(taxes.map((x) => x.paise));
    if (sub !== null) {
      const inferred = sub + taxSum - (disc?.paise ?? 0n) + (tip?.paise ?? 0n);
      notes.push('No total line found; total inferred from subtotal + tax - discount.');
      decision = { totalPaise: inferred, subtotalPaise: sub, taxLines: toLines(taxes), taxPaise: taxSum, discountPaise: disc?.paise ?? null, tipPaise: tip?.paise ?? null, roundOffPaise: null, confidence: { total: 0.6, subtotal: 0.8, tax: 0.7, discount: 0.6, tip: 0.6, roundOff: 0.3 }, reconciled: 'none', notes, totalLine: null };
    } else {
      const loose = lines.filter((l) => l.role !== 'recipient' && !itemLines.has(l.index) && !/gstin|phone|mobile|invoice\s*(?:no|date)|date|pin|ref|id\b/i.test(l.text)).flatMap((l) => moneyTokens(l.text).filter((t) => t.strong && t.paise > 0n).map((t) => ({ p: t.paise, line: l.index })));
      const best = loose.sort((a, b) => (a.p === b.p ? b.line - a.line : a.p > b.p ? -1 : 1))[0];
      notes.push(best ? 'No labelled total; used the largest standalone amount.' : 'No amounts found.');
      decision = { totalPaise: best?.p ?? 0n, subtotalPaise: null, taxLines: [], taxPaise: 0n, discountPaise: null, tipPaise: null, roundOffPaise: null, confidence: { ...conf, total: best ? 0.5 : 0.2 }, reconciled: 'none', notes, totalLine: best?.line ?? null };
    }
  }
  if (items.length && decision.subtotalPaise !== null && itemSum === decision.subtotalPaise) notes.push('Line items add up to the subtotal.');
  return decision;
}

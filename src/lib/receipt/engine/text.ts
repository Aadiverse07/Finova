/**
 * Stage 1 of the document-understanding engine: turn raw OCR / PDF text into clean, line-oriented text.
 *
 * Real-world inputs are messy:
 *  - PDF text often arrives as ONE long line (no newlines) -> we re-segment it on known labels.
 *  - Designed invoices letter-space their headings ("I N V O I C E") -> we collapse and re-split them.
 *  - OCR confuses O/0, I/1 inside numbers -> we repair those only inside numeric tokens.
 */
import type { Line, Role } from './types';

const VOCAB = [
  'INVOICE', 'TAX', 'BILL', 'BILLED', 'TO', 'FROM', 'DATE', 'DUE', 'TOTAL', 'AMOUNT', 'DESCRIPTION', 'QTY', 'QUANTITY',
  'UNIT', 'PRICE', 'RATE', 'ITEM', 'ITEMS', 'NOTES', 'NOTE', 'SUBTOTAL', 'GST', 'CGST', 'SGST', 'IGST', 'DISCOUNT', 'PAYMENT',
  'DETAILS', 'BALANCE', 'PAID', 'BY', 'RECEIPT', 'CASH', 'MEMO', 'SHIP', 'SOLD', 'HSN', 'SAC', 'NET', 'GRAND', 'PAYABLE',
  'CUSTOMER', 'VENDOR', 'SUPPLIER', 'STATUS', 'NO', 'NUMBER', 'TERMS', 'BANK', 'ACCOUNT', 'TOTALS', 'PARTICULARS', 'OF',
  'SUPPLY', 'ORDER', 'ID', 'GSTIN', 'PAN', 'THANK', 'YOU', 'SUMMARY', 'TRANSACTION', 'REFERENCE', 'UPI', 'SERVICE', 'CHARGE',
];
const VOCAB_SET = new Set(VOCAB);

function segmentSquished(upper: string): string | null {
  const n = upper.length;
  const best: Array<{ count: number; prev: number } | null> = Array.from({ length: n + 1 }, () => null);
  best[0] = { count: 0, prev: -1 };
  for (let i = 1; i <= n; i += 1) {
    for (let j = Math.max(0, i - 12); j < i; j += 1) {
      const prev = best[j];
      if (!prev || !VOCAB_SET.has(upper.slice(j, i))) continue;
      const count = prev.count + 1;
      const cur = best[i];
      if (!cur || count < cur.count) best[i] = { count, prev: j };
    }
  }
  if (!best[n]) return null;
  const words: string[] = [];
  let i = n;
  while (i > 0) {
    const b = best[i];
    if (!b) return null;
    words.unshift(upper.slice(b.prev, i));
    i = b.prev;
  }
  return words.join(' ');
}

/** "I N V O I C E" -> "INVOICE", "B I L L E D T O" -> "BILLED TO". */
export function collapseSpacedLetters(input: string): string {
  return input.replace(/(?<![A-Za-z])(?:[A-Za-z] ){2,}[A-Za-z](?![A-Za-z])/g, (m) => {
    const squished = m.replace(/ /g, '');
    const isUpper = m === m.toUpperCase();
    const seg = segmentSquished(squished.toUpperCase());
    if (seg) return isUpper ? seg : seg.toLowerCase();
    return squished;
  });
}

/** Repair digit look-alikes (O->0, I/l->1) but only inside tokens that already look like money. */
export function repairNumericTokens(line: string): string {
  return line.replace(/(?<![A-Za-z])[\dOoIl]{1,3}(?:,[\dOoIl]{2,3})+(?:\.[\dOoIl]{1,2})?(?![A-Za-z])|(?<![A-Za-z])\d[\dOoIl]*\.[\dOoIl]{1,2}(?![A-Za-z\d])/g, (tok) => {
    if (!/\d/.test(tok)) return tok;
    return tok.replace(/[Oo]/g, '0').replace(/[Il]/g, '1');
  });
}

export function normalizeText(raw: string): string {
  const cleaned = raw
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\r/g, '')
    .replace(/[\u00a0\u2007\u202f\t]/g, ' ')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[|¦]/g, ' ')
    .replace(/(\d)\s*\/-/g, '$1');
  return cleaned
    .split('\n')
    .map((l) => repairNumericTokens(collapseSpacedLetters(l)).replace(/[ ]{3,}/g, '  ').trim())
    .join('\n');
}

const BREAK_LABELS = [
  '(?:tax\\s+)?invoice\\s*(?:date|no\\.?|number|#)', '(?:tax\\s+)?invoice(?!\\s*(?:date|no\\.?|number|#))',
  'receipt(?!\\s*(?:date|no\\.?|number|#))', 'cash\\s*memo', 'bill\\s+of\\s+supply',
  'bill(?:ed)?\\s*to\\b', 'ship(?:ped)?\\s*to\\b', 'sold\\s*(?:to|by)\\b', 'bill\\s*(?:date|no\\.?|number)', 'date\\s*of\\s*issue',
  'issue\\s*date', 'due\\s*date', 'payment\\s*(?:due|terms|mode|method|status)', 'paid\\s*(?:by|via|through)\\b',
  'status\\s*[:\\-]?\\s*(?:paid|unpaid|overdue|pending|due|draft|partial)', 'description\\b', 'particulars\\b',
  'sub\\s*-?\\s*total', 'taxable\\s*(?:value|amount)', '(?:total\\s*)?(?:cgst|sgst|igst|utgst|cess)\\b',
  'tax\\s*(?:\\(|@|amount\\b|total\\b)', 'total\\s*(?:tax|gst)\\b', '(?:total\\s*)?discount\\b', 'round(?:ing)?[\\s-]*off',
  'grand\\s*total', 'total\\s*(?:due|amount|payable|invoice)\\b', 'amount\\s*(?:due|payable|paid)\\b', 'balance\\s*due',
  'net\\s*(?:amount|payable)', 'notes?\\b', 'terms\\b', 'gstin\\b', 'gst\\s*(?:no|number|in)\\b', 'pan\\s*[:\\-]',
  'phone\\b', 'mobile\\b', 'tel\\b', 'email\\b', 'utr\\b', 'upi\\s*(?:ref|id|transaction)', 'txn\\s*id', 'transaction\\s*id',
];
const BREAK_RE = new RegExp(`(?<![A-Za-z0-9])(?:${BREAK_LABELS.join('|')})`, 'gi');
const HEADER_WORD = /^(?:description|item|items|particulars|product|details|qty|quantity|unit|price|rate|amount|hsn|sac|code|sl\.?|no\.?|#|total|gst|tax|%)(?=\s|$)/i;

function explode(line: string): string[] {
  const matches = [...line.matchAll(BREAK_RE)];
  if (matches.length < 2 && line.length < 140) return [line];
  const cuts = matches.map((m) => m.index ?? 0).filter((i) => i > 0);
  if (!cuts.length) return [line];
  const parts: string[] = [];
  let last = 0;
  for (const cut of cuts) { parts.push(line.slice(last, cut)); last = cut; }
  parts.push(line.slice(last));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Splits a table-header run ("DESCRIPTION QTY UNIT PRICE AMOUNT Consulting ...") from the first row. */
function splitTableHeader(line: string): string[] {
  if (!/^(?:description|item|particulars|product)\b/i.test(line)) return [line];
  let rest = line;
  const header: string[] = [];
  for (;;) {
    const m = HEADER_WORD.exec(rest);
    if (!m) break;
    header.push(m[0]);
    rest = rest.slice(m[0].length).trimStart();
  }
  return rest ? [header.join(' '), rest] : [line];
}

const RECIPIENT = /^(?:bill(?:ed)?\s*to|ship(?:ped)?\s*to|sold\s*to|invoice\s*to|customer(?:\s*name)?|buyer|client|consignee|deliver(?:ed)?\s*to|attn|attention)\b\s*[:\-]?\s*/i;
const ISSUER = /^(?:sold\s*by|seller|supplier|vendor|merchant(?:\s*name)?|from|issued\s*by|billed\s*by|paid\s*to|payee|received\s*from)\b\s*[:\-]?\s*/i;
const RESET = /^(?:(?:tax\s+)?invoice\s*(?:date|no|number|#)|bill\s*(?:date|no)|date\b|due\s*date|description|particulars|item\b|status|sub\s*-?\s*total|total|grand|gstin|notes?|payment|terms|tax|cgst|sgst|igst|discount|qty|hsn)/i;

export function toLines(text: string): Line[] {
  const rawLines = normalizeText(text).split('\n').map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  for (const raw of rawLines) for (const part of explode(raw)) for (const row of splitTableHeader(part)) out.push(row.replace(/\s{2,}/g, ' ').trim());
  let role: Role = 'issuer';
  return out.filter(Boolean).map((t, index) => {
    if (RECIPIENT.test(t)) role = 'recipient';
    else if (ISSUER.test(t)) role = 'issuer';
    else if (role === 'recipient' && RESET.test(t)) role = 'neutral';
    return { text: t, index, role };
  });
}

export const RECIPIENT_LABEL = RECIPIENT;
export const ISSUER_LABEL = ISSUER;

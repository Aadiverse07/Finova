import type { Line } from './types';

export type PaymentMethod = 'Card' | 'UPI' | 'Cash' | 'Bank Transfer' | 'Wallet' | 'Other' | 'Unknown';
const KINDS: Array<[PaymentMethod, RegExp]> = [
  ['UPI', /\bupi\b|\bgpay\b|google\s*pay|phone\s*pe|phonepe|\bbhim\b|@(?:ok\w+|ybl|paytm|ibl|axl|sbi|upi)\b/i],
  ['Wallet', /\bwallet\b|paytm\s*balance|amazon\s*pay|mobikwik|freecharge/i],
  ['Card', /\b(?:visa|master\s*card|mastercard|rupay|amex|debit|credit|card|pos)\b/i],
  ['Bank Transfer', /\b(?:neft|rtgs|imps|bank\s*transfer|net\s*banking|cheque|check|ach|wire)\b/i],
  ['Cash', /\bcash\b(?!\s*(?:memo|discount|back|and\s*carry|counter))|\bcash\s*payment\b/i],
];
function classifyPayment(s: string): PaymentMethod | null { for (const [k, re] of KINDS) if (re.test(s)) return k; return null; }

export function pickPayment(lines: Line[], text: string): { value: PaymentMethod; confidence: number; reason: string } {
  const explicit = /(?:payment\s*(?:mode|method|type)|mode\s*of\s*payment|paid\s*(?:by|via|through|using|with)|tender(?:ed)?(?:\s*by)?|settled\s*(?:by|via))\s*[:\-]?\s*([A-Za-z@. ]{2,30})/i.exec(text);
  if (explicit) { const k = classifyPayment(explicit[1] ?? ''); if (k) return { value: k, confidence: 0.95, reason: `"${explicit[0].trim().slice(0, 40)}"` }; }
  const counts = new Map<PaymentMethod, number>();
  for (const l of lines) { if (l.role === 'recipient') continue; const k = classifyPayment(l.text); if (k) counts.set(k, (counts.get(k) ?? 0) + 1); }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (top) return { value: top[0], confidence: ranked.length > 1 && ranked[1]?.[1] === top[1] ? 0.55 : 0.82, reason: `mentioned on ${top[1]} line(s)` };
  const unpaid = /status\s*[:\-]?\s*(?:overdue|unpaid|pending|due|draft)|amount\s*due|balance\s*due|payment\s*due/i.exec(text);
  if (unpaid) return { value: 'Unknown', confidence: 0.7, reason: `document is unpaid ("${unpaid[0].trim()}"), so no payment method is printed` };
  return { value: 'Unknown', confidence: 0.25, reason: 'no payment method found' };
}

export function pickInvoiceNumber(lines: Line[]): { value: string; confidence: number } | null {
  const NUM = '([A-Z0-9][A-Z0-9\\/\\-_.]{2,29})';
  const cands = new Map<string, { score: number }>();
  const add = (raw: string | undefined, score: number) => {
    const v = (raw ?? '').replace(/[.\-/_]+$/g, '');
    if (!/\d/.test(v) || v.length < 3 || /^\d{10}$/.test(v) || /^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    const k = v.toUpperCase(); cands.set(k, { score: (cands.get(k)?.score ?? 0) + score });
  };
  for (const l of lines) {
    const t = l.text;
    add(new RegExp(`(?:invoice|inv|bill|receipt|voucher|order)\\s*(?:no\\.?|number|num|#|id)\\s*[:.\\-#]*\\s*${NUM}`, 'i').exec(t)?.[1], 10);
    add(new RegExp(`^(?:tax\\s+)?invoice\\s+${NUM}\\s*$`, 'i').exec(t)?.[1], 9);
    for (const m of t.matchAll(/\b(INV|BILL|RCP|REC|ORD)[-/]?[A-Z0-9\-/]*\d[A-Z0-9\-/]*/gi)) add(m[0], 4);
  }
  const best = [...cands.entries()].sort((a, b) => b[1].score - a[1].score)[0];
  return best ? { value: best[0], confidence: best[1].score >= 10 ? 0.93 : 0.8 } : null;
}

export function pickUpiRef(text: string) {
  const m = /(?:utr|rrn|upi\s*(?:ref(?:erence)?|transaction)?\s*(?:id|no|number)?|txn\s*id|transaction\s*id|reference\s*(?:id|no))\s*[:#\-]?\s*([A-Z0-9]{8,22})\b/i.exec(text);
  return m && /\d/.test(m[1] ?? '') ? (m[1] ?? null) : null;
}
export function pickCardLast4(text: string) { return /(?:card|visa|master\s*card|mastercard|rupay|x{2,}|\*{2,})[^\d\n]{0,14}(\d{4})(?!\d)/i.exec(text)?.[1] ?? null; }
export function pickPhone(text: string) { return /(?<![\d])(?:\+?91[\s-]?)?[6-9]\d{9}(?![\d])/.exec(text)?.[0]?.trim() ?? null; }

export function pickAddress(lines: Line[]) {
  const picked: string[] = [];
  for (const l of lines.slice(0, 14)) {
    if (l.role === 'recipient') continue;
    if (/\b\d{6}\b/.test(l.text) || /\b(?:road|rd\.?|street|nagar|colony|sector|floor|plot|lane|marg|complex|building)\b/i.test(l.text)) { if (!/gstin|invoice|date/i.test(l.text)) picked.push(l.text); }
    if (picked.length >= 3) break;
  }
  return picked.length ? picked.join(', ') : null;
}

export type DocType = 'retail_receipt' | 'restaurant_bill' | 'fuel_slip' | 'gst_invoice' | 'utility_bill' | 'travel_ticket' | 'handwritten_bill' | 'upi_screenshot' | 'bank_statement' | 'unknown';
export function detectDocType(text: string, hasGstin: boolean): DocType {
  const score: Partial<Record<DocType, number>> = {};
  const bump = (k: DocType, n: number) => { score[k] = (score[k] ?? 0) + n; };
  if (/\b(?:paid\s*to|payment\s*successful|transaction\s*successful|money\s*sent)\b/i.test(text)) bump('upi_screenshot', 4);
  if (/\b(?:utr|upi\s*(?:ref|transaction)\s*(?:id|no)?)\b/i.test(text)) bump('upi_screenshot', 3);
  if (/\b(?:statement\s*of\s*account|opening\s*balance|closing\s*balance)\b/i.test(text)) bump('bank_statement', 6);
  if (/\btax\s*invoice\b/i.test(text)) bump('gst_invoice', 4);
  if (/\b(?:cgst|sgst|igst)\b/i.test(text)) bump('gst_invoice', 2);
  if (/\binvoice\b/i.test(text)) bump('gst_invoice', 2);
  if (hasGstin) bump('gst_invoice', 3);
  if (/\b(?:petrol|diesel|fuel|nozzle|pump|litre|ltr)\b/i.test(text)) bump('fuel_slip', 5);
  if (/\b(?:table|waiter|server|dine[\s-]*in|kot|restaurant|cafe|service\s*charge)\b/i.test(text)) bump('restaurant_bill', 3);
  if (/\btable\s*\d+/i.test(text) && /\b(?:server|waiter|kot|service\s*charge)\b/i.test(text)) bump('restaurant_bill', 3);
  if (/\b(?:electricity|water\s*bill|broadband|consumer\s*no|units\s*consumed|meter|postpaid|utility)\b/i.test(text)) bump('utility_bill', 5);
  if (/\b(?:pnr|boarding|flight|irctc|train|departure|arrival|passenger)\b/i.test(text)) bump('travel_ticket', 5);
  const top = (Object.entries(score) as Array<[DocType, number]>).sort((a, b) => b[1] - a[1])[0];
  return top && top[1] >= 2 ? top[0] : 'retail_receipt';
}

export function pickCurrency(text: string) {
  if (/₹|\brs\b\.?|\binr\b/i.test(text)) return 'INR';
  if (/\bUSD\b|\$/.test(text)) return 'USD';
  if (/\bEUR\b|€/.test(text)) return 'EUR';
  if (/\bGBP\b|£/.test(text)) return 'GBP';
  return 'INR';
}

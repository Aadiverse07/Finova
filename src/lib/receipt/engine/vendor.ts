import { ISSUER_LABEL } from './text';
import type { Line, Scored } from './types';

const SUFFIX = /\b(?:pvt\.?|private|ltd\.?|limited|llp|llc|inc\.?|corp(?:oration)?|co\.|company|enterprises?|traders?|trading|stores?|mart|mall|agency|agencies|industries|technologies|technology|solutions|services|systems|labs?|foods?|restaurant|cafe|caf[eé]|hotel|pharmacy|medicals?|petroleum|fuels?|motors|electronics|supermarket|bazaar|retail|infotech|consultancy|consultants|associates|brothers|bros|bakery|sweets|kitchen|dhaba|stationers?|hardware|garage|clinic|hospital|airlines?|travels|telecom|networks?|communications)\b/i;
const BRANDS = ['Amazon', 'Flipkart', 'Swiggy', 'Zomato', 'BigBasket', 'Blinkit', 'Zepto', 'Reliance', 'DMart', 'Croma', 'Myntra', 'IRCTC', 'MakeMyTrip', 'Uber', 'Ola', 'Rapido', 'Airtel', 'Jio', 'BSNL', 'Vodafone', 'Tata Power', 'Indian Oil', 'HPCL', 'BPCL', 'Shell', 'Starbucks', "McDonald's", "Domino's", 'Pizza Hut', 'KFC', 'Google', 'Microsoft', 'Adobe', 'Zoom', 'Slack', 'Notion', 'GitHub', 'AWS', 'Apple', 'Spotify', 'Netflix', 'Canva', 'Figma', 'Staples', 'Apollo', 'MedPlus', 'PharmEasy', 'Lenskart', 'IndiGo', 'Air India', 'Vistara'];
const NOT_NAME = /^(?:tax\s*invoice|invoice|receipt|bill|cash\s*memo|original|duplicate|copy|customer\s*copy|page\s*\d|date|time|gstin|gst|pan|cin|fssai|phone|mobile|tel|email|e-mail|www|http|address|description|qty|total|subtotal|sub\s*total|amount|thank|welcome|bill\s*no|order|table|server|cashier|token|status|due|notes?|terms|payment|upi|utr|txn|transaction|round|discount|tax|cgst|sgst|igst|hsn|sac|item|particulars)\b/i;
const ADDRESS = /\b(?:road|rd\.?|street|st\.?|nagar|colony|sector|floor|plot|near|opp\.?|opposite|lane|marg|chowk|bazar|complex|building|tower|district|dist\.?|state|india|pin(?:code)?|ward|phase|block|shop\s*no|flat)\b/i;
const TAGLINE_WORDS = new Set(['accounting', 'workspace', 'books', 'platform', 'invoice', 'bill', 'receipt', 'tax', 'billing', 'statement', 'official', 'original', 'duplicate', 'copy']);
const TITLE_CUT = /\s+(?:tax\s+invoice|invoice|receipt|cash\s*memo|bill\s+of\s+supply)\b.*$/i;

const GENERIC = new Set(['pvt', 'ltd', 'private', 'limited', 'llp', 'inc', 'co', 'the', 'and', 'company']);
export function nameKey(s: string) { return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !GENERIC.has(w)).join(' '); }
function lev(a: string, b: string) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) { const cur = [i]; for (let j = 1; j <= n; j += 1) cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n] ?? 0;
}
export function similarity(a: string, b: string) { const x = nameKey(a), y = nameKey(b); if (!x || !y) return 0; if (x === y) return 1; return 1 - lev(x, y) / Math.max(x.length, y.length); }

function clean(text: string) {
  return text
    .replace(/^(?:welcome\s+to|thank\s+you\s+for\s+(?:shopping|visiting|dining)\s+(?:at|with))\s+/i, '')
    .replace(TITLE_CUT, '')
    .replace(/^[^A-Za-z0-9\u0900-\u097F]+|[^A-Za-z0-9\u0900-\u097F.)&'!]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
function stripTagline(name: string): { value: string; stripped: boolean } {
  const words = name.split(/\s+/);
  let end = words.length;
  while (end > 1 && TAGLINE_WORDS.has((words[end - 1] ?? '').toLowerCase())) end -= 1;
  return end < words.length && !SUFFIX.test(name) ? { value: words.slice(0, end).join(' '), stripped: true } : { value: name, stripped: false };
}

export type VendorResult = Scored<string> & { customer: string | null; runnerUp: string | null };

export function pickVendor(lines: Line[], history: Record<string, string> = {}, gstinLineIndex: number | null = null): VendorResult {
  type Cand = { text: string; score: number; why: string[] };
  const cands: Cand[] = [];
  let customer: string | null = null;
  for (const l of lines) {
    const rec = /^(?:bill(?:ed)?\s*to|ship(?:ped)?\s*to|sold\s*to|invoice\s*to|customer(?:\s*name)?|buyer|client|consignee)\b\s*[:\-]?\s*(.*)$/i.exec(l.text);
    if (rec && !customer) customer = clean(rec[1] ?? '') || clean(lines[l.index + 1]?.text ?? '') || null;
  }
  for (const l of lines) {
    if (l.role === 'recipient') continue;
    const explicit = ISSUER_LABEL.exec(l.text) ?? /^to\s*[:\-]\s*/i.exec(l.text);
    if (!explicit && l.index > 14) continue;
    let body = explicit ? l.text.slice(explicit[0].length) : l.text;
    if (explicit && !body.trim()) body = lines[l.index + 1]?.text ?? '';
    let text = clean(body);
    if (!text || text.length < 2 || text.length > 60) continue;
    if (!explicit && NOT_NAME.test(text)) continue;
    if (/@|www\.|https?:|\.com\b/i.test(text)) continue;
    if (!/[A-Za-z\u0900-\u097F]/.test(text)) continue;
    const digits = (text.match(/\d/g) ?? []).length;
    if (digits / text.length > 0.3) continue;
    const tag = stripTagline(text);
    text = tag.value;
    const words = text.split(/\s+/);
    if (words.length > 8) continue;
    let score = 0; const why: string[] = [];
    const pos = Math.max(0, 6 - l.index); score += pos; if (pos) why.push(`near top of document (line ${l.index + 1})`);
    if (explicit) { score += 8; why.push(`explicit "${explicit[0].trim()}" label`); }
    if (SUFFIX.test(text)) { score += 4; why.push('business-name suffix'); }
    const brand = BRANDS.find((b) => new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
    if (brand) { score += 5; why.push(`known merchant "${brand}"`); }
    if (words.length >= 1 && words.length <= 5 && /^[A-Z0-9\u0900-\u097F][\w&'.\u0900-\u097F-]*(?:\s+[A-Za-z0-9&'.\u0900-\u097F-]+)*$/.test(text)) score += 2;
    if (gstinLineIndex !== null && Math.abs(gstinLineIndex - l.index) <= 4) { score += 2; why.push('adjacent to supplier GSTIN'); }
    if (ADDRESS.test(text)) { score -= 6; why.push('looks like an address'); }
    if (tag.stripped) why.push('tagline removed');
    const hist = Object.keys(history).map((k) => ({ k, s: similarity(k, text) })).sort((a, b) => b.s - a.s)[0];
    if (hist && hist.s >= 0.86) { score += 4; why.push('matches a vendor you have used before'); }
    cands.push({ text, score, why });
  }
  cands.sort((a, b) => b.score - a.score);
  const best = cands[0];
  if (!best || best.score < 3) return { value: 'Unknown vendor', confidence: 0.25, reason: 'No line looked like a business name.', customer, runnerUp: null };
  const second = cands.find((c) => nameKey(c.text) !== nameKey(best.text));
  const margin = best.score - (second?.score ?? 0);
  let confidence = best.score >= 12 ? 0.95 : best.score >= 9 ? 0.9 : best.score >= 6 ? 0.8 : best.score >= 4 ? 0.66 : 0.5;
  if (margin <= 1 && best.score < 9) confidence -= 0.1;
  return { value: best.text, confidence: Math.max(0.3, Math.min(0.97, confidence)), reason: best.why.join('; ') || 'best available candidate', customer, runnerUp: second?.text ?? null };
}

import type { Account, Expense, Invoice, JournalEntry } from '@/lib/data/types';
import { accountBalance, accountTotals, balanceSheet, invoiceStatus, invoiceTotal, ledgerFor, profitAndLoss, signed, trialBalance } from '@/lib/data/calc';
import { r2 } from '@/lib/data/format';
import { dataVocabulary, norm, stem } from './text';

/**
 * Finova assistant engine. Pure, deterministic and LLM-free: it classifies the user's intent from the
 * question text, reads the SAME workspace data the pages render (accounts, journal, invoices, expenses)
 * and composes the answer. Zero network calls, zero tokens, works offline and for voice input.
 */
export type Workspace = { accounts: Account[]; entries: JournalEntry[]; invoices: Invoice[]; expenses: Expense[] };
export type AssistantLink = { label: string; href: string };
export type AssistantContext = { intent: string; question: string };
export type AssistantReply = { answer: string; intent: string; inScope: boolean; links?: AssistantLink[]; followUps?: string[]; context?: AssistantContext };

type Kind = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'fy' | 'days' | 'all';
export type Period = { kind: Kind; from?: string; to?: string; label: string; explicit: boolean; relThis?: boolean };
type Q = { raw: string; text: string; tokens: Set<string>; period?: Period; detail: boolean; ws: Workspace; now: string };
type Result = Omit<AssistantReply, 'intent' | 'inScope'> | undefined;

/* ───────────────────────── formatting & dates ───────────────────────── */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => { const t = new Date(Date.UTC(y, m, d)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
const parts = (s: string) => ({ y: Number(s.slice(0, 4)), m: Number(s.slice(5, 7)) - 1, d: Number(s.slice(8, 10)) });
const shift = (s: string, days: number) => { const p = parts(s); return iso(p.y, p.m, p.d + days); };
const daysBetween = (a: string, b: string) => Math.round((Date.UTC(parts(b).y, parts(b).m, parts(b).d) - Date.UTC(parts(a).y, parts(a).m, parts(a).d)) / 86_400_000);
const dShort = (s: string) => `${pad(parts(s).d)} ${MONTHS[parts(s).m]?.slice(0, 3)} ${parts(s).y}`;
const inr = (n: number) => {
  const v = r2(n);
  return `${v < 0 ? '-' : ''}₹${Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`;
};
const sum = (xs: number[]) => r2(xs.reduce((s, x) => s + x, 0));
const bullets = (lines: string[], q: Q, limit = 5) => {
  const max = q.detail ? 15 : limit;
  return lines.slice(0, max).map((l) => `• ${l}`).join('\n') + (lines.length > max ? `\n…and ${lines.length - max} more (say “show more” for the full list).` : '');
};
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '0%');

const monthPeriod = (y: number, m: number, label?: string, relThis = false): Period => ({ kind: 'month', from: iso(y, m, 1), to: iso(y, m + 1, 0), label: label ?? `${MONTHS[((m % 12) + 12) % 12]} ${new Date(Date.UTC(y, m, 1)).getUTCFullYear()}`, explicit: true, relThis });
const fyStart = (s: string) => { const p = parts(s); return p.m >= 3 ? p.y : p.y - 1; };

const MONTH_RE = /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\b(?:\s+(20\d\d))?/;
const monthIndex = (w: string) => MONTHS.findIndex((m) => m.toLowerCase().startsWith(w.slice(0, 3)));

/** Finds the EARLIEST period phrase in the text (so a follow-up's new period wins over the old question's). */
export function parsePeriod(input: string, now: string): Period | undefined {
  const text = input.toLowerCase();
  const np = parts(now);
  const found: { at: number; p: Period }[] = [];
  const add = (re: RegExp, build: (m: RegExpMatchArray) => Period | undefined) => { const m = text.match(re); if (m && m.index !== undefined) { const p = build(m); if (p) found.push({ at: m.index, p }); } };

  add(/\b(all time|overall|so far|to date|lifetime|ever|since the (start|beginning))\b/, () => ({ kind: 'all', label: 'across all recorded data', explicit: true }));
  add(/\btoday\b/, () => ({ kind: 'day', from: now, to: now, label: 'today', explicit: true }));
  add(/\byesterday\b/, () => ({ kind: 'day', from: shift(now, -1), to: shift(now, -1), label: 'yesterday', explicit: true }));
  const weekStart = shift(now, -((new Date(`${now}T00:00:00Z`).getUTCDay() + 6) % 7));
  add(/\b(this|current) week\b/, () => ({ kind: 'week', from: weekStart, to: shift(weekStart, 6), label: 'this week', explicit: true }));
  add(/\b(last|previous) week\b/, () => ({ kind: 'week', from: shift(weekStart, -7), to: shift(weekStart, -1), label: 'last week', explicit: true }));
  add(/\b(?:last|past|previous)\s+(\d{1,3})\s+(day|week|month)s?\b/, (m) => {
    const n = Number(m[1] ?? 0); const unit = m[2] ?? 'day';
    if (unit === 'month') return { kind: 'days', from: iso(np.y, np.m - n, np.d), to: now, label: `the last ${n} month${n > 1 ? 's' : ''}`, explicit: true };
    const len = unit === 'week' ? n * 7 : n;
    return { kind: 'days', from: shift(now, -(len - 1)), to: now, label: `the last ${len} days`, explicit: true };
  });
  add(/\b(this|current) month\b|\bis mahine\b/, () => monthPeriod(np.y, np.m, undefined, true));
  add(/\bpichhle mahine\b|\bpichle mahine\b/, () => monthPeriod(np.y, np.m - 1));
  add(/\b(last|previous|prior) month\b/, () => monthPeriod(np.y, np.m - 1));
  const fy = fyStart(now);
  const q0 = Math.floor(((np.m - 3 + 12) % 12) / 3); // FY quarter index of today (Apr-Jun = 0)
  const quarter = (offset: number): Period => {
    const idx = fy * 4 + q0 + offset; const y = Math.floor(idx / 4); const qi = ((idx % 4) + 4) % 4;
    const startM = 3 + qi * 3;
    return { kind: 'quarter', from: iso(y, startM, 1), to: iso(y, startM + 3, 0), label: `Q${qi + 1} FY${y}-${String(y + 1).slice(2)} (${MONTHS[startM % 12]?.slice(0, 3)}–${MONTHS[(startM + 2) % 12]?.slice(0, 3)})`, explicit: true };
  };
  add(/\b(this|current) quarter\b/, () => quarter(0));
  add(/\b(last|previous) quarter\b/, () => quarter(-1));
  add(/\b(this|current) (fy|financial year|fiscal year)\b|\b(fy|financial year|fiscal year)\b(?! ?20)/, () => ({ kind: 'fy', from: iso(fy, 3, 1), to: iso(fy + 1, 3, 0), label: `FY ${fy}-${String(fy + 1).slice(2)}`, explicit: true }));
  add(/\b(last|previous) (fy|financial year|fiscal year)\b/, () => ({ kind: 'fy', from: iso(fy - 1, 3, 1), to: iso(fy, 3, 0), label: `FY ${fy - 1}-${String(fy).slice(2)}`, explicit: true }));
  add(/\bbetween\s+(\d{1,2})\s+and\s+(\d{1,2})\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)(?:\s+(20\d\d))?\b/, (m) => {
    const mi = monthIndex(m[3] ?? ''); if (mi < 0) return undefined; const y = m[4] ? Number(m[4] ?? 0) : mi > np.m ? np.y - 1 : np.y;
    return { kind: 'days', from: iso(y, mi, Number(m[1] ?? 0)), to: iso(y, mi, Number(m[2] ?? 0)), label: `${Number(m[1] ?? 0)}–${Number(m[2] ?? 0)} ${MONTHS[mi]} ${y}`, explicit: true };
  });
  add(/\bfrom\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)(?:\s+(20\d\d))?\s+to\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)(?:\s+(20\d\d))?\b/, (m) => {
    const a = monthIndex(m[1] ?? ''); const b = monthIndex(m[3] ?? ''); if (a < 0 || b < 0) return undefined; const ay = m[2] ? Number(m[2] ?? 0) : a > np.m ? np.y - 1 : np.y; const by = m[4] ? Number(m[4] ?? 0) : (b < a ? ay + 1 : ay);
    return { kind: 'days', from: iso(ay, a, 1), to: iso(by, b + 1, 0), label: `${MONTHS[a]} ${ay}–${MONTHS[b]} ${by}`, explicit: true };
  });
  add(/\bsince\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)(?:\s+(20\d\d))?\b/, (m) => {
    const mi = monthIndex(m[1] ?? ''); if (mi < 0) return undefined; const y = m[2] ? Number(m[2] ?? 0) : mi > np.m ? np.y - 1 : np.y;
    return { kind: 'days', from: iso(y, mi, 1), to: now, label: `since ${MONTHS[mi]} ${y}`, explicit: true };
  });
  add(/\bq([1-4])\b(?:\s*(?:fy|financial year))?/, (m) => {
    const qi = Number(m[1] ?? 0) - 1; const startYear = fy + (qi > q0 ? -1 : 0); const startM = 3 + qi * 3;
    return { kind: 'quarter', from: iso(startYear, startM, 1), to: iso(startYear, startM + 3, 0), label: `Q${qi + 1} FY${startYear}-${String(startYear + 1).slice(2)}`, explicit: true };
  });
  add(/\b(this year|current year|year to date|ytd)\b/, () => ({ kind: 'year', from: iso(np.y, 0, 1), to: iso(np.y, 11, 31), label: String(np.y), explicit: true }));
  add(/\b(last|previous) year\b/, () => ({ kind: 'year', from: iso(np.y - 1, 0, 1), to: iso(np.y - 1, 11, 31), label: String(np.y - 1), explicit: true }));
  add(MONTH_RE, (m) => {
    const w = m[1] ?? '';
    // "may"/"mar" are only months when clearly used as one ("in may", "may 2026").
    if (w === 'may' && !m[2] && !/\b(in|of|for|during|from|since)\s+may\b/.test(text)) return undefined;
    const mi = monthIndex(w); if (mi < 0) return undefined;
    const y = m[2] ? Number(m[2] ?? 0) : mi > np.m ? np.y - 1 : np.y;
    return monthPeriod(y, mi);
  });
  if (!found.length) return undefined;
  return found.sort((a, b) => a.at - b.at)[0]?.p;
}

/** The period right before `p`, plus the phrase to use when comparing ("last month", "September 2026"…). */
function previous(p: Period): { period: Period; word: string } | undefined {
  if (!p.from || !p.to || p.kind === 'all') return undefined;
  const a = parts(p.from);
  if (p.kind === 'month') { const pp = monthPeriod(a.y, a.m - 1); return { period: pp, word: p.relThis ? 'last month' : pp.label }; }
  if (p.kind === 'quarter') return { period: { kind: 'quarter', from: iso(a.y, a.m - 3, 1), to: iso(a.y, a.m, 0), label: 'the previous quarter', explicit: true }, word: 'the previous quarter' };
  if (p.kind === 'year' || p.kind === 'fy') return { period: { kind: p.kind, from: iso(a.y - 1, a.m, a.d), to: shift(p.from, -1), label: 'the previous year', explicit: true }, word: 'the previous year' };
  const len = daysBetween(p.from, p.to) + 1;
  return { period: { kind: 'days', from: shift(p.from, -len), to: shift(p.from, -1), label: 'the previous period', explicit: true }, word: 'the previous period' };
}

const cmp = (cur: number, prev: number, word: string, lowerIsBetter = false) => {
  const d = r2(cur - prev);
  if (!d) return `the same as ${word}`;
  if (!prev) return `${d > 0 ? 'up' : 'down'} from nothing recorded in ${word}`;
  return `${inr(Math.abs(d))} ${d > 0 ? 'higher' : 'lower'} than ${word} (${d > 0 ? '+' : '−'}${Math.abs(Math.round((d / Math.abs(prev)) * 100))}%)${lowerIsBetter ? '' : ''}`;
};

/* ───────────────────────── text understanding ───────────────────────── */
const has = (q: Q, ...words: string[]) => words.some((w) => q.tokens.has(stem(w)));
const GENERIC = new Set(['business', 'limited', 'ltd', 'pvt', 'private', 'services', 'solutions', 'technologies', 'industries', 'retail', 'foods', 'expense', 'account', 'payable', 'receivable', 'revenue', 'the', 'and', 'for']);
const STOP = new Set(['how', 'much', 'many', 'did', 'does', 'was', 'were', 'are', 'what', 'which', 'show', 'tell', 'give', 'list', 'the', 'and', 'for', 'with', 'from', 'that', 'this', 'last', 'month', 'week', 'year', 'quarter', 'total', 'most', 'all', 'any', 'have', 'has', 'been', 'i', 'me', 'my', 'we', 'our', 'is', 'on', 'in', 'of', 'to', 'a', 'an', 'it', 'by', 'about', 'please', 'spend', 'spent', 'cost', 'costing', 'expense', 'amount', 'there', 'than', 'then', 'also', 'recent', 'latest', 'entry', 'entrie', 'transaction', 'journal', 'summary', 'details', 'more']);

const DOMAIN = ['financ', 'account', 'ledger', 'journal', 'transaction', 'invoice', 'expense', 'spend', 'spent', 'spending', 'revenue', 'income', 'sale', 'cash', 'bank', 'balance', 'payable', 'receivable', 'gst', 'igst', 'cgst', 'sgst', 'tax', 'vendor', 'customer', 'client', 'profit', 'loss', 'margin', 'report', 'overdue', 'unpaid', 'paid', 'pending', 'draft', 'marketing', 'salary', 'rent', 'software', 'travel', 'utility', 'office', 'supply', 'bill', 'payment', 'owe', 'owed', 'due', 'debit', 'credit', 'asset', 'liability', 'equity', 'capital', 'trial', 'sheet', 'dashboard', 'entry', 'cost', 'budget', 'money', 'rupee', 'receipt', 'purchase', 'subscription', 'finova', 'books', 'bookkeeping', 'accounting', 'fund', 'outstanding', 'collect', 'earn', 'turnover', 'chart', 'journal', 'posting', 'post', 'reconcile', 'fy', 'quarter', 'module', 'page', 'insight', 'overview', 'summary', 'p&l', 'pnl', 'worth', 'discount', 'amount', 'gross', 'net'].map(stem);

const SMALLTALK = /^(hi|hii+|hello|hey|namaste|good (morning|afternoon|evening)|yo|sup)\b/;
const THANKS = /\b(thanks|thank you|thx|great|awesome|perfect|nice|cool|ok(ay)?)\b/;
const BYE = /\b(bye|goodbye|see you|cya)\b/;
const HELP = /\b(help|what can you do|what do you do|how do you work|capabilities|features|who are you|what are you)\b/;
const NAV_VERB = /\b(open|go to|goto|take me|navigate|switch to|bring up|redirect|jump to)\b|\bwhere (can|do|is|are)\b/;
const HOWTO = /\bhow (do|can|should|would|to)\b|\bsteps? (to|for)\b|\bguide\b|\bhow-to\b/;
const FOLLOWUP = /^(and|also|what about|how about|same|now|then|what if|but)\b|^(show )?(me )?(more|details?|breakdown|the full list)\b|\bfull list\b|^(why|explain)\b/;

const WEAK = new Set(['capital', 'post', 'page', 'module', 'chart', 'net', 'gross', 'amount', 'due', 'credit', 'debit', 'earn', 'fund', 'cost', 'money', 'sheet', 'bill', 'payment', 'paid', 'draft', 'office', 'travel', 'rent', 'budget', 'summary', 'overview', 'quarter', 'fy', 'collect', 'owe', 'owed', 'loss', 'worth', 'discount', 'tax', 'sale', 'entry', 'account'].map(stem));
const OFFTOPIC = /\b(capital of|president of|prime minister|who (is|was|invented|discovered)|weather|temperature|recipe|joke|poem|song|lyrics|movie|film|football|cricket|score of|translate|horoscope|bitcoin|crypto|stock price|share price|news|write (me )?(a|an|some) (poem|story|essay|code|program|script|email to)|tell me about (yourself|history)|meaning of life|solve|equation|homework)\b/;

const CREATIVE = /\b(write|compose|create|draft|make) (me )?(a|an|some|the)? ?(poem|story|essay|song|joke|code|program|script|haiku|speech|rap)\b|\b(tell me|say) a joke\b|\bpoem\b/;

export function isInScope(question: string, ws?: Workspace): boolean {
  const text = norm(question);
  if (!text) return false;
  if (CREATIVE.test(text)) return false;
  if (SMALLTALK.test(text) || THANKS.test(text) || BYE.test(text) || HELP.test(text) || NAV_VERB.test(text) || HOWTO.test(text)) return true;
  if (/\b(inv|exp|je)[- ]?\d/.test(text) || /p ?& ?l/.test(text)) return true;
  const toks = text.split(' ').map(stem);
  const vocab = ws ? dataVocabulary(ws) : undefined;
  if (toks.some((t) => DOMAIN.includes(t) && !WEAK.has(t))) return true;
  if (OFFTOPIC.test(text)) return false; // weak words like "capital" must not let general-knowledge questions through
  return toks.some((t) => DOMAIN.includes(t) || vocab?.has(t));
}

const REFUSAL = 'I’m Finova’s finance assistant, so I can only help with things inside this workspace — expenses, invoices, accounts, journal entries, GST, cash, profit and reports. Try one of these:';
export const STARTER_QUESTIONS = ['How much did I spend this month?', 'Show me unpaid invoices', 'Which expense category costs the most?', 'Give me a business summary', 'Any insights I should act on?'];

/* ───────────────────────── data helpers ───────────────────────── */
const posted = (ws: Workspace) => ws.entries.filter((e) => e.status === 'Posted');
const inRange = (d: string, p: Period) => (!p.from || d >= p.from) && (!p.to || d <= p.to);
const byType = (ws: Workspace, type: Account['type']) => ws.accounts.filter((a) => a.type === type);
const spendByAccount = (ws: Workspace, p: Period) => { const t = accountTotals(ws.entries, { from: p.from, to: p.to }); return byType(ws, 'EXPENSE').map((a) => ({ account: a, amount: signed(a, t.get(a.id) ?? { debit: 0, credit: 0 }) })).filter((r) => r.amount !== 0); };
const incomeTotal = (ws: Workspace, p: Period) => profitAndLoss(ws.accounts, ws.entries, p.from, p.to).totalIncome;
const outstanding = (ws: Workspace, now: string) => ws.invoices.map((i) => ({ i, st: invoiceStatus(i, now), total: invoiceTotal(i) })).filter((x) => x.st === 'Pending' || x.st === 'Overdue').sort((a, b) => a.i.dueDate.localeCompare(b.i.dueDate));
const pendingExpenses = (ws: Workspace) => ws.expenses.filter((e) => e.status === 'Pending');

/** Default to "this month"; if the user gave no period and nothing matches this month, walk back (up to 24 months) to the latest month that does, and say so. */
function resolvePeriod(q: Q, measure: (p: Period) => number): { p: Period; note: string } {
  if (q.period) return { p: q.period, note: '' };
  const np = parts(q.now);
  const cur = monthPeriod(np.y, np.m, undefined, true);
  if (measure(cur) !== 0) return { p: cur, note: '' };
  for (let k = 1; k <= 24; k++) {
    const fb = monthPeriod(np.y, np.m - k);
    if (measure(fb) !== 0) return { p: fb, note: `Nothing is recorded for ${cur.label} yet, so here’s ${fb.label}.\n\n` };
  }
  return { p: cur, note: '' };
}

function matchAccounts(q: Q, accounts: Account[]): Account[] {
  const alias: Record<string, string[]> = {
    marketing: ['advertising', 'ads', 'ad', 'promotion', 'campaign', 'promo', 'seo'], travel: ['uber', 'cab', 'taxi', 'flight', 'hotel', 'trip', 'ola', 'transport'],
    utility: ['utility', 'internet', 'electricity', 'power', 'water', 'wifi', 'broadband', 'bill'], software: ['subscription', 'saas', 'license', 'licence', 'cloud', 'tool', 'app'],
    office: ['stationery', 'supply', 'printer', 'cartridge', 'stationary'], rent: ['lease', 'landlord'], bank: ['hdfc'], cash: ['petty'],
  };
  const scored = accounts.map((a) => {
    const nameToks = norm(a.name).split(' ').filter((t) => t.length > 2 && !GENERIC.has(t)).map(stem);
    const extra = Object.entries(alias).filter(([k]) => a.name.toLowerCase().includes(k)).flatMap(([, v]) => v).map(stem);
    const score = [...new Set([...nameToks, ...extra])].filter((t) => q.tokens.has(t)).length + (new RegExp(`\\b${a.code}\\b`).test(q.text) ? 2 : 0);
    return { a, score };
  });
  const top = Math.max(0, ...scored.map((s) => s.score));
  return top ? scored.filter((s) => s.score === top).map((s) => s.a) : [];
}

const nameMatches = (q: Q, name: string) => norm(name).split(' ').filter((t) => t.length > 2 && !GENERIC.has(t)).map(stem).some((t) => q.tokens.has(t));
const customersIn = (q: Q) => [...new Set(q.ws.invoices.map((i) => i.customer))].filter((c) => nameMatches(q, c));
const vendorsIn = (q: Q) => [...new Set(q.ws.expenses.map((e) => e.vendor))].filter((v) => nameMatches(q, v));

/* ───────────────────────── intent handlers ───────────────────────── */
const PAGES: { href: string; label: string; re: RegExp }[] = [
  { href: '/dashboard', label: 'Dashboard', re: /dashboard/ }, { href: '/', label: 'Home', re: /\bhome\b|landing/ },
  { href: '/journal', label: 'Transactions', re: /journal|transaction|ledger entr/ }, { href: '/invoices', label: 'Invoices', re: /invoice|receivable|billing/ },
  { href: '/expenses', label: 'Expenses', re: /expense|spend|vendor/ }, { href: '/reports', label: 'Reports', re: /report|trial balance|p ?& ?l|profit|balance sheet|ledger/ },
  { href: '/accounts', label: 'Chart of Accounts', re: /chart of account|accounts?\b/ },
];

function smalltalk(q: Q): Result {
  if (HELP.test(q.text)) return { answer: 'I answer from your live Finova data — no guessing, and no figures I can’t find in your records. I can:\n\n• Total and compare spending (by category, vendor, period)\n• List unpaid, overdue, paid or draft invoices and who owes you\n• Report revenue, profit & loss, balance sheet, trial balance, cash and GST\n• Look up any account, journal entry, invoice (INV-…) or expense (EXP-…)\n• Flag things that need attention, and open any module or explain how to use it\n\nType or use the mic — voice notes work too.', followUps: STARTER_QUESTIONS.slice(0, 3) };
  if (BYE.test(q.text)) return { answer: 'Goodbye! I’ll be here whenever you need your numbers.' };
  if (SMALLTALK.test(q.text) && q.text.split(' ').length <= 4) return { answer: 'Hi! I’m Finova AI. Ask me about your expenses, invoices, accounts, journal entries, GST, cash or reports.', followUps: STARTER_QUESTIONS.slice(0, 3) };
  if (THANKS.test(q.text) && q.text.split(' ').length <= 4) return { answer: 'Happy to help! Anything else you’d like to check?' };
  return undefined;
}

function navigate(q: Q): Result {
  if (!NAV_VERB.test(q.text) || HOWTO.test(q.text)) return undefined;
  const page = PAGES.find((p) => p.re.test(q.text));
  if (!page) return undefined;
  return { answer: `Here’s the ${page.label} page.`, links: [{ label: `Open ${page.label}`, href: page.href }] };
}

const GUIDES: { re: RegExp; text: string; link: AssistantLink }[] = [
  { re: /invoice/, text: 'To create an invoice: open Invoices, use the create-invoice button, fill in the customer, dates, line items, tax and discount, then save it as Draft or Pending. Pending invoices post to Accounts Receivable automatically. When the customer pays, open the invoice and click “Mark as Paid” — the receipt entry is posted for you.', link: { label: 'Open Invoices', href: '/invoices' } },
  { re: /expense/, text: 'To record an expense: open Expenses, click “Add expense”, choose the category, vendor, amount, payment method and status, then “Save expense”. A balanced journal entry is posted automatically (Paid → bank/cash, Pending → Accounts Payable).', link: { label: 'Open Expenses', href: '/expenses' } },
  { re: /journal|transaction|entry/, text: 'To add a manual entry: open Transactions, start a new entry, add at least two lines so total debits equal total credits, then “Post entry” (or “Save as draft” to finish later). Unbalanced entries can’t be posted.', link: { label: 'Open Transactions', href: '/journal' } },
  { re: /account/, text: 'To add an account: open Chart of Accounts, click “Add account”, enter the code, name, type and description, then “Save account”.', link: { label: 'Open Chart of Accounts', href: '/accounts' } },
  { re: /report|balance sheet|trial|profit|ledger/, text: 'Open Reports and pick a tab — Ledger, Trial Balance, Profit & Loss or Balance Sheet — then set the date range. I can also read any of these out to you here.', link: { label: 'Open Reports', href: '/reports' } },
];
function howTo(q: Q): Result {
  if (!HOWTO.test(q.text)) return undefined;
  const g = GUIDES.find((x) => x.re.test(q.text));
  return g ? { answer: g.text, links: [g.link] } : undefined;
}

function lookupRecord(q: Q): Result {
  const inv = q.text.match(/\binv[- ]?(?:(20\d\d)[- ]?)?(\d{1,4})\b/);
  if (inv) {
    const n = Number(inv[2]); const found = q.ws.invoices.find((i) => Number(i.number.match(/(\d+)$/)?.[1]) === n && (!inv[1] || i.number.includes(inv[1])));
    if (!found) return { answer: `I couldn’t find an invoice matching “${inv[0]}”.` };
    const st = invoiceStatus(found, q.now); const total = invoiceTotal(found);
    const extra = st === 'Overdue' ? ` It is ${daysBetween(found.dueDate, q.now)} day(s) overdue.` : st === 'Pending' ? ` It is due in ${daysBetween(q.now, found.dueDate)} day(s).` : st === 'Paid' ? ` Paid on ${found.paidOn ? dShort(found.paidOn) : 'an unrecorded date'}.` : '';
    return { answer: `${found.number} — ${found.customer}\n• Total: ${inr(total)} (tax ${inr(found.tax)}, discount ${inr(found.discount)})\n• Issued ${dShort(found.date)}, due ${dShort(found.dueDate)}\n• Status: ${st}.${extra}`, links: [{ label: 'Open Invoices', href: '/invoices' }] };
  }
  const ex = q.text.match(/\bexp[- ]?(?:(20\d\d)[- ]?)?(\d{1,4})\b/);
  if (ex) {
    const n = Number(ex[2]); const e = q.ws.expenses.find((x) => Number(x.id.match(/(\d+)$/)?.[1]) === n);
    if (!e) return { answer: `I couldn’t find an expense matching “${ex[0]}”.` };
    return { answer: `${e.id} — ${e.vendor}\n• ${e.category}: ${e.description}\n• Amount: ${inr(e.amount)} on ${dShort(e.date)}, via ${e.paymentMethod}\n• Status: ${e.status}`, links: [{ label: 'Open Expenses', href: '/expenses' }] };
  }
  const je = q.text.match(/\bje[- ]?(\d{1,6})\b/);
  if (je) {
    const entry = q.ws.entries.find((x) => Number(x.id.replace(/\D/g, '')) === Number(je[1]));
    if (!entry) return { answer: `I couldn’t find a journal entry matching “${je[0]}”.` };
    const name = (id: string) => q.ws.accounts.find((a) => a.id === id)?.name ?? id;
    return { answer: `${entry.id} — ${entry.description}\n• ${dShort(entry.date)} · ${entry.status} · ${entry.source} · ref ${entry.reference}\n${entry.lines.map((l) => `• ${name(l.accountId)}: ${l.debit ? `Dr ${inr(l.debit)}` : `Cr ${inr(l.credit)}`}`).join('\n')}`, links: [{ label: 'Open Transactions', href: '/journal' }] };
  }
  return undefined;
}

function insights(q: Q): string[] {
  const out: string[] = []; const { ws, now } = q;
  const open = outstanding(ws, now);
  const overdue = open.filter((x) => x.st === 'Overdue');
  if (overdue.length) { const oldest = overdue[0]!; out.push(`${overdue.length} overdue invoice(s) worth ${inr(sum(overdue.map((x) => x.total)))} — oldest is ${oldest.i.number} (${oldest.i.customer}), ${daysBetween(oldest.i.dueDate, now)} day(s) late. Follow up first.`); }
  const soon = open.filter((x) => x.st === 'Pending' && daysBetween(now, x.i.dueDate) <= 7);
  if (soon.length) out.push(`${soon.length} invoice(s) worth ${inr(sum(soon.map((x) => x.total)))} fall due within 7 days.`);
  const total = sum(open.map((x) => x.total));
  const byCust = new Map<string, number>(); open.forEach((x) => byCust.set(x.i.customer, r2((byCust.get(x.i.customer) ?? 0) + x.total)));
  const topC = [...byCust].sort((a, b) => b[1] - a[1])[0];
  if (topC && byCust.size > 1 && topC[1] / total > 0.5) out.push(`${topC[0]} accounts for ${pct(topC[1], total)} of what customers owe you — high concentration risk.`);
  const { p } = resolvePeriod({ ...q, period: undefined }, (pp) => spendByAccount(ws, pp).length);
  const prev = previous(p);
  if (prev) {
    const cur = new Map(spendByAccount(ws, p).map((r) => [r.account.name, r.amount])); const old = new Map(spendByAccount(ws, prev.period).map((r) => [r.account.name, r.amount]));
    const spikes = [...cur].filter(([n, a]) => (old.get(n) ?? 0) > 0 && a > (old.get(n) ?? 0) * 1.25 && a - (old.get(n) ?? 0) > 1000).sort((a, b) => b[1] - (old.get(b[0]) ?? 0) - (a[1] - (old.get(a[0]) ?? 0)));
    const s = spikes[0]; if (s) out.push(`${s[0]} spending rose to ${inr(s[1])} in ${p.label} from ${inr(old.get(s[0]) ?? 0)} before.`);
  }
  const pl = profitAndLoss(ws.accounts, ws.entries, p.from, p.to);
  if (pl.netProfit < 0) out.push(`You ran at a net loss of ${inr(-pl.netProfit)} in ${p.label} (expenses ${inr(pl.totalExpenses)} vs income ${inr(pl.totalIncome)}).`);
  const pend = pendingExpenses(ws);
  const cash = sum(ws.accounts.filter((a) => a.type === 'ASSET' && /bank|cash/i.test(a.name)).map((a) => accountBalance(a, ws.entries)));
  if (pend.length) { const t = sum(pend.map((e) => e.amount)); out.push(`${pend.length} expense(s) totalling ${inr(t)} are still unpaid; cash on hand is ${inr(cash)}${cash < t ? ' — not enough to cover them.' : ', enough to cover them.'}`); }
  for (const a of ws.accounts.filter((x) => x.type === 'ASSET' && /bank|cash/i.test(x.name))) { const b = accountBalance(a, ws.entries); if (b < 0) out.push(`${a.name} shows a negative balance of ${inr(b)} — usually a missing opening balance or an unrecorded deposit.`); }
  const drafts = ws.invoices.filter((i) => i.status === 'Draft').length; if (drafts) out.push(`${drafts} draft invoice(s) haven’t been sent/posted yet, so that revenue isn’t in your books.`);
  const dEntries = ws.entries.filter((e) => e.status === 'Draft').length; if (dEntries) out.push(`${dEntries} draft journal entr${dEntries === 1 ? 'y is' : 'ies are'} unposted and excluded from reports.`);
  const tb = trialBalance(ws.accounts, ws.entries); if (!tb.balanced) out.push(`Your trial balance is off by ${inr(Math.abs(tb.difference))} — debits and credits don’t match.`);
  return out;
}

function insightsHandler(q: Q): Result {
  const wantsInsights = has(q, 'insight', 'alert', 'attention', 'risk', 'suggest', 'advice', 'recommend', 'improve', 'warning') || /\b(anything|something) (wrong|off|urgent)|should i (worry|act|do|focus)|save money|cut costs?|what needs|red flag/.test(q.text);
  const wantsOverview = has(q, 'summary', 'overview', 'snapshot', 'status', 'health') || /how (am i|are we|is (my|the|our)).*(doing|business|company|going)|business (summary|health)|at a glance|big picture/.test(q.text);
  if (!wantsInsights && !wantsOverview) return undefined;
  const list = insights(q);
  const tail = list.length ? bullets(list, q, 6) : 'Nothing needs urgent attention right now — no overdue invoices, spending spikes or ledger problems detected.';
  if (wantsInsights && !wantsOverview) return { answer: `${list.length ? 'Here’s what deserves your attention:\n' : ''}${tail}`, followUps: ['Show me overdue invoices', 'Which expense category costs the most?'], links: [{ label: 'Open Dashboard', href: '/dashboard' }] };
  const { p, note } = resolvePeriod(q, (pp) => incomeTotal(q.ws, pp) + sum(spendByAccount(q.ws, pp).map((r) => r.amount)));
  const pl = profitAndLoss(q.ws.accounts, q.ws.entries, p.from, p.to);
  const open = outstanding(q.ws, q.now); const cash = sum(q.ws.accounts.filter((a) => a.type === 'ASSET' && /bank|cash/i.test(a.name)).map((a) => accountBalance(a, q.ws.entries, { to: q.now })));
  return { answer: `${note}Business snapshot for ${p.label}:\n• Income ${inr(pl.totalIncome)} · Expenses ${inr(pl.totalExpenses)} · Net ${pl.netProfit < 0 ? 'loss' : 'profit'} ${inr(Math.abs(pl.netProfit))}${pl.totalIncome ? ` (${Math.round(pl.margin)}% margin)` : ''}\n• Cash & bank: ${inr(cash)}\n• Customers owe you ${inr(sum(open.map((x) => x.total)))} across ${open.length} invoice(s)\n\nAttention points:\n${tail}`, followUps: ['Show me unpaid invoices', 'Show my profit and loss'], links: [{ label: 'Open Dashboard', href: '/dashboard' }] };
}

function trial(q: Q): Result {
  if (!(/trial balance/.test(q.text) || /(books?|ledger|accounts?).*(balanced|tally|tallies|match)|debits? (and|=|equal).*credits?|do(es)? (my|the) books/.test(q.text))) return undefined;
  const tb = trialBalance(q.ws.accounts, q.ws.entries, q.period?.to);
  return { answer: tb.balanced ? `Your books balance ✅ — total debits and credits are both ${inr(tb.debit)} across ${tb.rows.length} active accounts.` : `Your trial balance is off ⚠️ — debits ${inr(tb.debit)} vs credits ${inr(tb.credit)} (difference ${inr(Math.abs(tb.difference))}). Review recent manual entries.`, links: [{ label: 'Open Reports', href: '/reports' }] };
}

function balanceSheetHandler(q: Q): Result {
  if (!(/balance sheet/.test(q.text) || has(q, 'asset', 'liability', 'equity', 'worth') || /net worth|what do i own/.test(q.text))) return undefined;
  if (matchAccounts(q, q.ws.accounts).length && !/balance sheet/.test(q.text)) return undefined;
  const bs = balanceSheet(q.ws.accounts, q.ws.entries, q.period?.to ?? q.now);
  const rows = (xs: { account: Account; amount: number }[]) => xs.map((r) => `${r.account.name}: ${inr(r.amount)}`);
  const only = has(q, 'liability') ? 'L' : has(q, 'asset') ? 'A' : has(q, 'equity') ? 'E' : '';
  const sections = [only !== 'L' && only !== 'E' && `Assets — ${inr(bs.totalAssets)}\n${bullets(rows(bs.assets), q, 8)}`, only !== 'A' && only !== 'E' && `Liabilities — ${inr(bs.totalLiabilities)}\n${bullets(rows(bs.liabilities), q, 8)}`, only !== 'A' && only !== 'L' && `Equity — ${inr(bs.totalEquity)} (includes current earnings of ${inr(bs.currentEarnings)})`].filter(Boolean);
  return { answer: `${sections.join('\n\n')}\n\n${bs.balanced ? 'Assets = Liabilities + Equity ✅' : 'Heads up: the balance sheet does not balance ⚠️'}`, links: [{ label: 'Open Reports', href: '/reports' }] };
}

function profitHandler(q: Q): Result {
  if (!(has(q, 'profit', 'loss', 'margin', 'pnl', 'earn') || /p ?& ?l|income statement|net income|bottom line|making money/.test(q.text))) return undefined;
  const { p, note } = resolvePeriod(q, (pp) => { const r = profitAndLoss(q.ws.accounts, q.ws.entries, pp.from, pp.to); return r.totalIncome + r.totalExpenses; });
  const pl = profitAndLoss(q.ws.accounts, q.ws.entries, p.from, p.to); const prev = previous(p);
  const pp = prev && profitAndLoss(q.ws.accounts, q.ws.entries, prev.period.from, prev.period.to);
  const head = pl.netProfit >= 0 ? `Net profit for ${p.label}: ${inr(pl.netProfit)}` : `Net loss for ${p.label}: ${inr(-pl.netProfit)}`;
  return { answer: `${note}${head}${pl.totalIncome ? ` — a ${Math.round(pl.margin)}% margin` : ''}.\n• Income: ${inr(pl.totalIncome)}\n• Expenses: ${inr(pl.totalExpenses)}${pp && prev ? `\n• Net result is ${cmp(pl.netProfit, pp.netProfit, prev.word)}` : ''}${pl.expenses.length ? `\n\nBiggest costs:\n${bullets([...pl.expenses].sort((a, b) => b.amount - a.amount).map((r) => `${r.account.name}: ${inr(r.amount)}`), q, 3)}` : ''}`, links: [{ label: 'Open P&L report', href: '/reports' }], followUps: ['Which expense category costs the most?'] };
}

function gstHandler(q: Q): Result {
  if (!has(q, 'gst', 'igst', 'cgst', 'sgst', 'tax')) return undefined;
  const acc = q.ws.accounts.find((a) => /gst/i.test(a.name));
  const { p, note } = resolvePeriod(q, (pp) => sum(q.ws.invoices.filter((i) => i.status !== 'Draft' && inRange(i.date, pp)).map((i) => i.tax)));
  const billed = q.ws.invoices.filter((i) => i.status !== 'Draft' && inRange(i.date, p));
  const bal = acc ? accountBalance(acc, q.ws.entries, { to: q.now }) : 0;
  return { answer: `${note}• GST collected on invoices in ${p.label}: ${inr(sum(billed.map((i) => i.tax)))} across ${billed.length} invoice(s)\n• GST Payable balance in your books: ${inr(bal)}${bal > 0 ? ' (owed to the government)' : ''}\n\nNote: input tax credit on expenses isn’t tracked in the Expenses module yet, so the net GST due may be lower.`, links: [{ label: 'Open Invoices', href: '/invoices' }] };
}

function payables(q: Q): Result {
  const owes = /\b(i|we) owe\b|do i owe|payables?\b|bills? to pay|vendor dues?|what (is|are) (due|payable)|accounts payable|unpaid (expenses?|bills?|vendors?)|pending (expenses?|bills?)|(expenses?|bills?) (still )?(unpaid|pending|due)/.test(q.text);
  if (!owes || /owes? me|owed to me|owe us/.test(q.text)) return undefined;
  const pend = pendingExpenses(q.ws).sort((a, b) => a.date.localeCompare(b.date)); const ap = q.ws.accounts.find((a) => /payable/i.test(a.name) && a.type === 'LIABILITY');
  const apBal = ap ? accountBalance(ap, q.ws.entries, { to: q.now }) : 0;
  const lines = pend.map((e) => `${e.id} — ${e.vendor}: ${inr(e.amount)} (${e.category}, dated ${dShort(e.date)})`);
  return { answer: `${pend.length ? `You have ${pend.length} unpaid expense(s) totalling ${inr(sum(pend.map((e) => e.amount)))}:\n${bullets(lines, q)}` : 'You have no unpaid expense records.'}\n\nAccounts Payable in your ledger: ${inr(apBal)}${apBal !== sum(pend.map((e) => e.amount)) ? ' (this also includes opening/manual balances)' : ''}.`, links: [{ label: 'Open Expenses', href: '/expenses' }], followUps: ['What is my cash balance?'] };
}

function invoicesHandler(q: Q): Result {
  const custs = customersIn(q);
  const isInv = has(q, 'invoice', 'receivable', 'outstanding', 'unpaid', 'overdue', 'collect', 'billed', 'billing') || /owes? me|owed to me|owe us|who owes|late payment|payments? (due|pending)/.test(q.text) || (custs.length > 0 && has(q, 'owe', 'bill', 'due', 'pay', 'paid', 'invoice'));
  if (!isInv || /\b(expense|vendor)s?\b/.test(q.text) && !has(q, 'invoice')) return undefined;
  const all = q.ws.invoices.map((i) => ({ i, st: invoiceStatus(i, q.now), total: invoiceTotal(i) }));
  const scoped = custs.length ? all.filter((x) => custs.includes(x.i.customer)) : all;
  const who = custs.length ? ` for ${custs.join(' & ')}` : '';
  const line = (x: (typeof all)[number]) => `${x.i.number} — ${x.i.customer}: ${inr(x.total)}${x.st === 'Overdue' ? `, ${daysBetween(x.i.dueDate, q.now)}d overdue (due ${dShort(x.i.dueDate)})` : x.st === 'Pending' ? `, due ${dShort(x.i.dueDate)} (in ${daysBetween(q.now, x.i.dueDate)}d)` : x.st === 'Paid' ? `, paid${x.i.paidOn ? ` ${dShort(x.i.paidOn)}` : ''}` : ', draft'}`;
  const links = [{ label: 'Open Invoices', href: '/invoices' }];
  const sorted = (xs: typeof all) => [...xs].sort((a, b) => a.i.dueDate.localeCompare(b.i.dueDate));

  if (/who owes|owes? me the most|biggest (debtor|customer)|top (customer|debtor)|largest (debtor|customer)/.test(q.text)) {
    const g = new Map<string, number>(); scoped.filter((x) => x.st === 'Pending' || x.st === 'Overdue').forEach((x) => g.set(x.i.customer, r2((g.get(x.i.customer) ?? 0) + x.total)));
    const rows = [...g].sort((a, b) => b[1] - a[1]); const tot = sum(rows.map((r) => r[1]));
    return { answer: rows.length ? `Customers owe you ${inr(tot)} in total:\n${bullets(rows.map(([n, a]) => `${n}: ${inr(a)} (${pct(a, tot)})`), q)}` : 'No customer owes you anything right now — all invoices are paid or still drafts.', links };
  }
  if (has(q, 'overdue') || /late|past due/.test(q.text)) {
    const xs = sorted(scoped.filter((x) => x.st === 'Overdue'));
    return { answer: xs.length ? `${xs.length} overdue invoice(s)${who}, totalling ${inr(sum(xs.map((x) => x.total)))}:\n${bullets(xs.map(line), q)}\n\nThe oldest is the best one to chase first.` : `Good news — no overdue invoices${who}.`, links, followUps: ['Show me unpaid invoices'] };
  }
  if (/due (soon|this week|next|in the next)|upcoming|coming due/.test(q.text)) {
    const xs = sorted(scoped.filter((x) => x.st === 'Pending' && daysBetween(q.now, x.i.dueDate) <= 7));
    return { answer: xs.length ? `${xs.length} invoice(s)${who} fall due within 7 days, totalling ${inr(sum(xs.map((x) => x.total)))}:\n${bullets(xs.map(line), q)}` : `No invoices${who} are due in the next 7 days.`, links };
  }
  if (has(q, 'draft')) {
    const xs = scoped.filter((x) => x.st === 'Draft');
    return { answer: xs.length ? `${xs.length} draft invoice(s)${who}, worth ${inr(sum(xs.map((x) => x.total)))} (not yet in your books):\n${bullets(xs.map(line), q)}` : `No draft invoices${who}.`, links };
  }
  if (has(q, 'paid') && !has(q, 'unpaid')) {
    const xs = scoped.filter((x) => x.st === 'Paid' && (!q.period || (x.i.paidOn && inRange(x.i.paidOn, q.period))));
    return { answer: xs.length ? `${xs.length} paid invoice(s)${who}${q.period ? ` in ${q.period.label}` : ''}, totalling ${inr(sum(xs.map((x) => x.total)))}:\n${bullets(xs.map(line), q)}` : `I found no paid invoices${who}${q.period ? ` in ${q.period.label}` : ''}.`, links };
  }
  if (has(q, 'unpaid', 'outstanding', 'receivable', 'collect', 'owe', 'pending') || /payments? (due|pending)/.test(q.text)) {
    const xs = sorted(scoped.filter((x) => x.st === 'Pending' || x.st === 'Overdue')); const od = xs.filter((x) => x.st === 'Overdue');
    return { answer: xs.length ? `${xs.length} unpaid invoice(s)${who}, totalling ${inr(sum(xs.map((x) => x.total)))}${od.length ? ` — ${od.length} overdue (${inr(sum(od.map((x) => x.total)))})` : ''}:\n${bullets(xs.map(line), q)}` : `No unpaid invoices${who} — everything issued has been paid.`, links, followUps: od.length ? ['Show me overdue invoices', 'Who owes me the most?'] : ['Who owes me the most?'] };
  }
  if (custs.length) {
    return { answer: `${custs.join(' & ')} — ${scoped.length} invoice(s), ${inr(sum(scoped.map((x) => x.total)))} billed, ${inr(sum(scoped.filter((x) => x.st === 'Pending' || x.st === 'Overdue').map((x) => x.total)))} still unpaid:\n${bullets(sorted(scoped).map(line), q)}`, links };
  }
  const inP = q.period ? scoped.filter((x) => inRange(x.i.date, q.period!)) : scoped; const cnt = (s: string) => inP.filter((x) => x.st === s);
  const row = (s: string, label: string) => `${label}: ${cnt(s).length} · ${inr(sum(cnt(s).map((x) => x.total)))}`;
  return { answer: `Invoice summary${q.period ? ` for ${q.period.label}` : ''} — ${inP.length} invoice(s), ${inr(sum(inP.filter((x) => x.st !== 'Draft').map((x) => x.total)))} billed:\n• ${row('Paid', 'Paid')}\n• ${row('Pending', 'Pending')}\n• ${row('Overdue', 'Overdue')}\n• ${row('Draft', 'Draft')}`, links, followUps: ['Show me unpaid invoices'] };
}

function revenueHandler(q: Q): Result {
  if (!(has(q, 'revenue', 'income', 'sale', 'turnover', 'earning') || /how much (did|have) (i|we) (make|made|earn|earned|bring)|money (came|coming) in/.test(q.text))) return undefined;
  const { p, note } = resolvePeriod(q, (pp) => incomeTotal(q.ws, pp));
  const prev = previous(p); const cur = incomeTotal(q.ws, p);
  const t = accountTotals(q.ws.entries, { from: p.from, to: p.to });
  const src = byType(q.ws, 'INCOME').map((a) => ({ a, v: signed(a, t.get(a.id) ?? { debit: 0, credit: 0 }) })).filter((x) => x.v);
  const billed = q.ws.invoices.filter((i) => i.status !== 'Draft' && inRange(i.date, p));
  return { answer: `${note}Revenue for ${p.label}: ${inr(cur)}${prev ? ` — ${cmp(cur, incomeTotal(q.ws, prev.period), prev.word)}` : ''}.${src.length > 1 ? `\n${bullets(src.map((x) => `${x.a.name}: ${inr(x.v)}`), q)}` : ''}${billed.length ? `\n\nInvoiced in this period: ${inr(sum(billed.map(invoiceTotal)))} across ${billed.length} invoice(s) (incl. tax).` : ''}`, links: [{ label: 'Open P&L report', href: '/reports' }], followUps: ['Show my profit and loss'] };
}

function spendHandler(q: Q): Result {
  if (!(has(q, 'expense', 'spend', 'spent', 'spending', 'cost', 'expenditure', 'purchase', 'outflow', 'marketing', 'salary', 'rent', 'software', 'travel', 'utility', 'vendor', 'supplier') || /who do i pay|where (is|does) (my )?money go|money go(ing)?|burn/.test(q.text))) return undefined;
  const vendors = vendorsIn(q); const accs = vendors.length ? [] : matchAccounts(q, byType(q.ws, 'EXPENSE'));
  const total = (p: Period) => accs.length ? sum(spendByAccount(q.ws, p).filter((r) => accs.some((a) => a.id === r.account.id)).map((r) => r.amount)) : vendors.length ? sum(q.ws.expenses.filter((e) => vendors.includes(e.vendor) && inRange(e.date, p)).map((e) => e.amount)) : sum(spendByAccount(q.ws, p).map((r) => r.amount));
  const { p, note } = resolvePeriod(q, total); const prev = previous(p); const cur = total(p);
  const links = [{ label: 'Open Expenses', href: '/expenses' }];

  // "Which category costs the most?" / ranking
  if (!accs.length && !vendors.length && (/\b(most|highest|biggest|largest|top|costliest|expensive)\b/.test(q.text) || has(q, 'category', 'categories', 'breakdown', 'split'))) {
    if (/\bvendor|supplier|who do i pay/.test(q.text)) {
      const g = new Map<string, number>(); q.ws.expenses.filter((e) => inRange(e.date, p)).forEach((e) => g.set(e.vendor, r2((g.get(e.vendor) ?? 0) + e.amount)));
      const rows = [...g].sort((a, b) => b[1] - a[1]);
      return { answer: rows.length ? `${note}Top vendors by spend in ${p.label}:\n${bullets(rows.map(([n, a]) => `${n}: ${inr(a)} (${pct(a, cur)})`), q)}` : `No expenses recorded in ${p.label}.`, links };
    }
    if (/\b(single|one|transaction|expense)\b.*\b(biggest|largest|highest)\b|\b(biggest|largest|highest)\b (single |one )?(expense|transaction|payment|purchase)\b/.test(q.text) && !has(q, 'category', 'categories')) {
      const xs = q.ws.expenses.filter((e) => inRange(e.date, p)).sort((a, b) => b.amount - a.amount);
      return { answer: xs.length ? `${note}Largest expense in ${p.label}: ${xs[0]!.id} — ${xs[0]!.vendor}, ${inr(xs[0]!.amount)} (${xs[0]!.description}, ${dShort(xs[0]!.date)}).\n\nNext largest:\n${bullets(xs.slice(1).map((e) => `${e.vendor}: ${inr(e.amount)} — ${e.category}`), q, 3)}` : `No expenses recorded in ${p.label}.`, links };
    }
    const rows = spendByAccount(q.ws, p).sort((a, b) => b.amount - a.amount);
    if (!rows.length) return { answer: `No expenses are recorded for ${p.label}.`, links };
    const t = sum(rows.map((r) => r.amount));
    return { answer: `${note}${rows[0]!.account.name} is your biggest expense in ${p.label}: ${inr(rows[0]!.amount)}, ${pct(rows[0]!.amount, t)} of total spending (${inr(t)}).\n\n${bullets(rows.map((r) => `${r.account.name}: ${inr(r.amount)} (${pct(r.amount, t)})`), q, 6)}${prev ? `\n\nTotal spending is ${cmp(t, total(prev.period), prev.word)}.` : ''}`, links, followUps: ['How does that compare to last month?', 'Any insights I should act on?'] };
  }

  const what = accs.length ? accs.map((a) => a.name).join(' & ') : vendors.length ? vendors.join(' & ') : '';
  if (!cur) {
    const ever = total({ kind: 'all', explicit: true, label: 'all' });
    return { answer: ever ? `I found no ${what ? `${what} ` : ''}spending in ${p.label}.${prev && total(prev.period) ? ` For comparison, ${prev.word} had ${inr(total(prev.period))}.` : ''}` : `I couldn’t find any ${what ? `${what} ` : ''}spending recorded yet.`, links };
  }
  let detail = '';
  if (accs.length) {
    const ids = new Set(accs.map((a) => a.id)); const rows = posted(q.ws).filter((e) => inRange(e.date, p)).flatMap((e) => e.lines.filter((l) => ids.has(l.accountId)).map((l) => ({ e, v: r2(l.debit - l.credit) }))).sort((a, b) => b.e.date.localeCompare(a.e.date));
    detail = `\n\n${bullets(rows.map((r) => `${dShort(r.e.date)} — ${r.e.description}: ${inr(r.v)}`), q)}`;
  } else if (vendors.length) {
    const rows = q.ws.expenses.filter((e) => vendors.includes(e.vendor) && inRange(e.date, p)).sort((a, b) => b.date.localeCompare(a.date));
    detail = `\n\n${bullets(rows.map((e) => `${dShort(e.date)} — ${e.description}: ${inr(e.amount)} (${e.status})`), q)}`;
  } else {
    const rows = spendByAccount(q.ws, p).sort((a, b) => b.amount - a.amount);
    detail = `\n\nTop categories:\n${bullets(rows.map((r) => `${r.account.name}: ${inr(r.amount)} (${pct(r.amount, cur)})`), q, 3)}`;
  }
  return { answer: `${note}You spent ${inr(cur)}${what ? ` on ${what}` : ''} in ${p.label}${prev ? `, which is ${cmp(cur, total(prev.period), prev.word)}` : ''}.${detail}`, links, followUps: what ? ['Which expense category costs the most?'] : ['Which expense category costs the most?', 'Show unpaid expenses'] };
}

function cashHandler(q: Q): Result {
  const named = matchAccounts({ ...q, tokens: new Set([...q.tokens].filter((t) => t !== 'cash' && t !== 'bank')) }, q.ws.accounts);
  if (!(has(q, 'cash', 'bank', 'fund', 'liquidity', 'balance') || /how much money|money (do i|i) have|runway/.test(q.text))) return undefined;
  if (named.length && has(q, 'ledger', 'statement', 'transaction', 'activity')) return undefined;
  if (named.length && !named.every((a) => a.type === 'ASSET' && /bank|cash/i.test(a.name))) return undefined;
  const accs = (named.length ? named : q.ws.accounts.filter((a) => a.type === 'ASSET' && /bank|cash/i.test(a.name)));
  if (!accs.length) return undefined;
  const to = q.period?.to && q.period.to < q.now ? q.period.to : q.now;
  const rows = accs.map((a) => ({ a, v: accountBalance(a, q.ws.entries, { to }) })); const cash = sum(rows.map((r) => r.v));
  const recv = sum(outstanding(q.ws, q.now).map((x) => x.total)); const pay = sum(pendingExpenses(q.ws).map((e) => e.amount));
  return { answer: `${accs.length > 1 ? `Cash & bank total${to !== q.now ? ` as of ${dShort(to)}` : ''}: ${inr(cash)}\n${bullets(rows.map((r) => `${r.a.name}: ${inr(r.v)}`), q)}` : `${accs[0]!.name} balance: ${inr(cash)}`}${named.length ? '' : `\n\nAhead of you: ${inr(recv)} to collect from customers and ${inr(pay)} in unpaid expenses — net ${inr(cash + recv - pay)} once both settle.`}`, links: [{ label: 'Open Reports', href: '/reports' }], followUps: ['Show me unpaid invoices'] };
}

function accountHandler(q: Q): Result {
  const hit = matchAccounts(q, q.ws.accounts);
  const listing = /chart of accounts|list (of )?(all )?(my )?accounts|all accounts|(my|the) accounts|accounts? (list|summary)|summari[sz]e (my )?accounts/.test(q.text) || (has(q, 'account') && !hit.length);
  if (hit.length && (has(q, 'balance', 'ledger', 'statement', 'activity', 'transaction', 'much', 'show', 'what', 'detail') || hit.length === 1) && !(listing && !hit.length)) {
    const a = hit[0]!; const to = q.period?.to ?? q.now;
    const bal = accountBalance(a, q.ws.entries, { to });
    if (has(q, 'ledger', 'statement', 'transaction', 'activity')) {
      const l = ledgerFor(a, q.ws.entries, q.period?.from, q.period?.to);
      return { answer: `${a.code} · ${a.name} — closing balance ${inr(l.closing)}${l.opening ? ` (opening ${inr(l.opening)})` : ''}.\n${l.rows.length ? bullets(l.rows.slice().reverse().map((r) => `${dShort(r.date)} — ${r.description}: ${r.debit ? `Dr ${inr(r.debit)}` : `Cr ${inr(r.credit)}`} → ${inr(r.balance)}`), q) : 'No postings in this period.'}`, links: [{ label: 'Open Reports', href: '/reports' }] };
    }
    const act = q.period ? accountBalance(a, q.ws.entries, { from: q.period.from, to: q.period.to }) : undefined;
    return { answer: `${a.code} · ${a.name} (${a.type.toLowerCase()}, normal ${a.normalBalance.toLowerCase()} balance${a.isActive ? '' : ', inactive'}) — balance ${inr(bal)}${to !== q.now ? ` as of ${dShort(to)}` : ''}.${act !== undefined ? `\nActivity in ${q.period!.label}: ${inr(act)}.` : ''}${a.description ? `\n${a.description}.` : ''}`, links: [{ label: 'Open Chart of Accounts', href: '/accounts' }] };
  }
  if (!listing) return undefined;
  const t = accountTotals(q.ws.entries, { to: q.now });
  const order: Account['type'][] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
  const groups = order.map((ty) => { const xs = byType(q.ws, ty); return xs.length ? `${ty[0]}${ty.slice(1).toLowerCase()} (${xs.length})\n${bullets(xs.map((a) => `${a.code} ${a.name}: ${inr(signed(a, t.get(a.id) ?? { debit: 0, credit: 0 }))}`), q, 8)}` : ''; }).filter(Boolean);
  return { answer: `You have ${q.ws.accounts.length} accounts (${q.ws.accounts.filter((a) => a.isActive).length} active):\n\n${groups.join('\n\n')}`, links: [{ label: 'Open Chart of Accounts', href: '/accounts' }] };
}

function journalHandler(q: Q): Result {
  if (!has(q, 'journal', 'transaction', 'entry', 'posting', 'ledger', 'reference')) return undefined;
  if (matchAccounts(q, q.ws.accounts).length && !has(q, 'journal', 'entry')) return undefined; // "ledger/transactions of HDFC" → account handler
  const src = (['MANUAL', 'INVOICE', 'PAYMENT', 'EXPENSE', 'OPENING'] as const).find((s) => q.text.includes(s.toLowerCase()));
  const draft = has(q, 'draft'); const STRUCT = new Set(['journal', 'entry', 'transaction', 'posting', 'ledger', 'reference', 'manual', 'invoice', 'payment', 'opening', 'draft', 'expense', 'posted', 'show', 'list', 'many', 'count', 'number', 'there', 'are', 'any'].map(stem));
  const filterToks = [...q.tokens].filter((t) => t.length > 2 && !STOP.has(t) && !STRUCT.has(t) && !MONTH_RE.test(t) && !/^\d+$/.test(t) && !/^(last|this|previous|current|past|week|month|year|quarter|today|yesterday)$/.test(t));
  let xs = q.ws.entries.filter((e) => (draft ? e.status === 'Draft' : true) && (src ? e.source === src : true) && (q.period ? inRange(e.date, q.period) : true));
  if (filterToks.length) { const f = xs.filter((e) => filterToks.some((t) => `${e.description} ${e.reference}`.toLowerCase().includes(t))); if (f.length) xs = f; }
  xs = [...xs].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id, undefined, { numeric: true }));
  const amt = (e: JournalEntry) => sum(e.lines.map((l) => l.debit));
  const count = /how many|count|number of/.test(q.text);
  if (!xs.length) return { answer: draft ? 'You have no draft journal entries — everything has been posted.' : 'I found no journal entries matching that.', links: [{ label: 'Open Transactions', href: '/journal' }] };
  const total = xs.length; const postedCount = xs.filter((e) => e.status === 'Posted').length;
  if (count) xs = xs.slice(0, 3);
  return { answer: `${count || total > 5 ? `${total} journal entr${total === 1 ? 'y' : 'ies'} match${total === 1 ? 'es' : ''} (${postedCount} posted, ${total - postedCount} draft).\n` : ''}${bullets(xs.map((e) => `${e.id} · ${dShort(e.date)} — ${e.description} (${inr(amt(e))}, ${e.source.toLowerCase()}${e.status === 'Draft' ? ', draft' : ''})`), q)}`, links: [{ label: 'Open Transactions', href: '/journal' }] };
}

/* ───────────────────────── public API ───────────────────────── */
const RULES: [string, (q: Q) => Result][] = [
  ['smalltalk', smalltalk], ['navigate', navigate], ['how_to', howTo], ['lookup', lookupRecord], ['insights', insightsHandler], ['trial_balance', trial], ['balance_sheet', balanceSheetHandler],
  ['profit_loss', profitHandler], ['gst', gstHandler], ['payables', payables], ['invoices', invoicesHandler], ['journal', journalHandler], ['revenue', revenueHandler], ['spending', spendHandler],
  ['cash', cashHandler], ['accounts', accountHandler],
];

export function answerQuestion(question: string, ws: Workspace, opts: { now?: string; context?: AssistantContext } = {}): AssistantReply {
  const now = opts.now ?? new Date().toLocaleDateString('en-CA');
  let text = norm(question);
  const ctx = opts.context;
  // Follow-ups ("and last month?", "show more") re-run the previous question with the new bits first.
  const followUp = !!ctx && text.split(' ').length <= 7 && FOLLOWUP.test(text) && !/\b(inv|exp|je)[- ]?\d/.test(text) && !/\b(details?|more) (of|on|about|for)\b/.test(text) && !/\b(invoice|expense|account|journal|profit|revenue|gst|cash)\b/.test(text.replace(/\bmore\b/, ''));
  const merged = followUp && ctx ? norm(`${text} ${ctx.question}`) : text;
  if (!merged) return { answer: 'Please type or say a question about your finances.', intent: 'empty', inScope: true };
  if (!followUp && !isInScope(merged, ws)) return { answer: REFUSAL, intent: 'out_of_scope', inScope: false, followUps: STARTER_QUESTIONS.slice(0, 3) };

  const q: Q = { raw: question, text: merged, tokens: new Set(merged.split(' ').map(stem)), period: parsePeriod(merged, now), detail: /\b(more|details?|breakdown|full list|everything|all of them|show all)\b/.test(text), ws, now };
  for (const [intent, rule] of RULES) {
    const r = rule(q);
    if (r) return { ...r, intent, inScope: true, context: { intent, question: merged.slice(0, 300) } };
  }
  return { answer: 'I can read your records, but I’m not sure what you’d like to know. Try asking about spending, invoices, revenue, profit, cash, accounts or journal entries — for example:', intent: 'clarify', inScope: true, followUps: STARTER_QUESTIONS.slice(0, 4) };
}

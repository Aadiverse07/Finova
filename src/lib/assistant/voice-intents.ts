import { addDays, todayISO } from '@/lib/data/format';
import { parseInvoiceVoice, routeVoiceCommand, type AssistantAction } from './tools';

/**
 * Natural-language voice/text command understanding for Finova.
 * Pure and deterministic: maps what the user says to a module, a filtered view, or an action,
 * and rejects requests that have nothing to do with the website.
 */
export type VoiceIntent =
  | { kind: 'navigate'; path: string; label: string }
  | { kind: 'action'; action: AssistantAction }
  | { kind: 'back' }
  | { kind: 'offtopic' };

type Mod = { path: string; label: string; words: string[] };
/** Every module/page of the website with the many ways people refer to it (English, Hinglish, Hindi). */
export const MODULES: Mod[] = [
  { path: '/dashboard', label: 'Dashboard', words: ['dashboard', 'overview', 'summary', 'analytics', 'डैशबोर्ड'] },
  { path: '/journal', label: 'Transactions', words: ['journal', 'journals', 'transaction', 'transactions', 'journal entry', 'journal entries', 'ledger entries', 'लेनदेन', 'जर्नल'] },
  { path: '/invoices', label: 'Invoices', words: ['invoice', 'invoices', 'billing', 'bills', 'sales', 'receivable', 'receivables', 'इनवॉइस', 'इन्वॉइस', 'बिल'] },
  { path: '/expenses', label: 'Expenses', words: ['expense', 'expenses', 'expenditure', 'spending', 'spendings', 'kharcha', 'kharche', 'kharch', 'खर्च', 'खर्चे'] },
  { path: '/reports', label: 'Reports', words: ['report', 'reports', 'reporting', 'रिपोर्ट'] },
  { path: '/accounts', label: 'Chart of Accounts', words: ['accounts', 'chart of accounts', 'account list', 'coa', 'खाते'] },
  { path: '/customers', label: 'Customers', words: ['customer', 'customers', 'client', 'clients', 'party', 'parties', 'debtors', 'ग्राहक'] },
  { path: '/bank', label: 'Banking', words: ['bank', 'banking', 'bank statement', 'bank transactions', 'बैंक'] },
  { path: '/forecast', label: 'Cash Forecast', words: ['forecast', 'cash forecast', 'cash flow', 'cashflow', 'prediction', 'projection', 'पूर्वानुमान'] },
  { path: '/receipt-scanner', label: 'Receipt Scanner', words: ['receipt scanner', 'scan receipt', 'scan receipts', 'scanner', 'receipt scan', 'scan', 'रसीद'] },
  { path: '/receipt-archive', label: 'Receipt Archive', words: ['receipt archive', 'receipts', 'saved receipts', 'archive'] },
  { path: '/settings/language', label: 'Language settings', words: ['language settings', 'language setting', 'settings', 'setting', 'preferences', 'सेटिंग'] },
  { path: '/support', label: 'Support', words: ['support', 'help', 'help center', 'helpdesk', 'सहायता'] },
  { path: '/contact', label: 'Contact', words: ['contact', 'contact us', 'संपर्क'] },
  { path: '/about', label: 'About', words: ['about', 'about us', 'about finova'] },
  { path: '/mission', label: 'Mission', words: ['mission'] },
  { path: '/vision', label: 'Vision', words: ['vision'] },
  { path: '/status', label: 'System status', words: ['status page', 'system status', 'service status'] },
  { path: '/', label: 'Home', words: ['home', 'homepage', 'home page', 'main page', 'landing', 'होम'] },
];
const REPORT_TABS: [RegExp, string, string][] = [
  [/profit\s*(?:and|&|n)?\s*loss|\bp\s*(?:and|&|n)\s*l\b|\bpnl\b|income statement/, 'pnl', 'Profit & Loss'],
  [/balance sheet/, 'balance', 'Balance Sheet'],
  [/trial balance/, 'trial', 'Trial Balance'],
  [/general ledger|account ledger/, 'ledger', 'Ledger'],
];

const NAV_VERB = /\b(open|opens|opened|go|goto|going|take me|takes me|bring me|navigate|navigation|show|show me|display|switch|jump|launch|visit|load|see|view|check|kholo|khol do|kholiye|dikhao|dikha do|dikhaiye|jao|chalo|le chalo|le jao|dekhna|dekho)\b|खोलो|खोलिए|खोल दो|दिखाओ|दिखाइए|जाओ|जाइए|ले चलो|देखो|ओपन/;
const CREATE_VERB = /\b(add|create|make|new|record|log|enter|raise|generate|post|book|banao|bana|banado|jodo|daalo|dalo|darj)\b|जोड़ो|बनाओ|बनाइए|दर्ज/;
const QUESTION = /\b(how much|how many|what|what's|whats|which|who|when|why|total|sum|average|count|kitna|kitni|kitne|kya|kaun|kab|compare|tell me|batao|bataiye|bata do)\b|कितना|कितनी|कितने|क्या|बताओ|बताइए/;
const FILLER = /\b(please|plz|pls|kindly|can you|could you|would you|will you|i want to|i wanna|i would like to|i'd like to|i need to|i need|let's|lets|just|now|quickly|right now|for me|to me|the|my|our|a|an|module|modules|page|pages|section|screen|tab|window|menu|karo|kar do|kardo|do|zara|mujhe|mera|meri|mere|ko|ka|ki|ke|me|mein|में|को|का|की|के|मुझे|मेरा|मेरी|कृपया|जरा|ज़रा)\b/gi;

const DOMAIN = /\b(finova|invoice|invoices|bill|bills|expense|expenses|spend|spent|spending|income|revenue|profit|loss|payment|payments|paid|unpaid|overdue|pending|outstanding|receivable|payable|customer|customers|client|vendor|vendors|supplier|account|accounts|ledger|journal|entry|entries|transaction|transactions|bank|banking|statement|balance|sheet|report|reports|tax|gst|gstin|receipt|receipts|scan|scanner|forecast|cash|cashflow|budget|dashboard|module|page|rupees?|rs|inr|lakh|crore|thousand|category|categories|alert|alerts|notification|notifications|theme|dark mode|light mode|language|hindi|english|hinglish|search|find|settings|support|help|contact|about|mission|vision|home|download|export|pdf|undo|kharcha|kharch|aamdani|kamai|baaki|baki|paisa|paise|hisab|khata|खर्च|आय|बकाया|बिल|इनवॉइस|ग्राहक|बैंक|रिपोर्ट|खाता|रसीद|लेनदेन|फिनोवा)\b|खर्च|बकाया|इनवॉइस|ग्राहक|बैंक|रिपोर्ट|रसीद|लेनदेन|फिनोवा|₹|\d/i;
export const isFinovaRelated = (text: string) => DOMAIN.test(text.normalize('NFKC'));

function lev(a: string, b: string) { const p = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(c[j - 1]! + 1, p[j]! + 1, p[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)); for (let j = 0; j <= b.length; j++) p[j] = c[j]!; } return p[b.length]!; }
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Find the module a sentence refers to. Longest phrase wins; single words tolerate one misrecognised letter. */
export function findModule(lower: string): Mod | null {
  let best: { m: Mod; len: number } | null = null;
  for (const m of MODULES) for (const w of m.words) {
    const hit = /[ऀ-ॿ]/.test(w) ? lower.includes(w) : new RegExp(`(?:^|\\s)${esc(w)}(?=\\s|$)`).test(lower);
    if (hit && (!best || w.length > best.len)) best = { m, len: w.length };
  }
  if (best) return best.m;
  const tokens = lower.split(/\s+/).filter((t) => t.length >= 5);
  for (const m of MODULES) for (const w of m.words) if (!w.includes(' ') && w.length >= 6 && tokens.some((t) => lev(t, w) <= 1)) return m;
  return null;
}

/** Statement window from speech: "last 7 days", "this week", "yesterday", "this month"... Capped at the last 30 days. */
export function parseStatementRange(lower: string, today = todayISO(), maxDays = 30) {
  const floor = addDays(today, -maxDays);
  let from = floor, to = today, requested = maxDays;
  const n = lower.match(/(?:last|past|previous)?\s*(\d{1,3})\s*(day|days|week|weeks)\b/);
  if (/\byesterday\b/.test(lower)) { from = to = addDays(today, -1); requested = 1; }
  else if (/\btoday\b|\baaj\b|आज/.test(lower)) { from = to = today; requested = 0; }
  else if (n) { requested = Number(n[1]) * (n[2]!.startsWith('week') ? 7 : 1); from = addDays(today, -requested); }
  else if (/\b(fortnight|two weeks)\b/.test(lower)) { requested = 14; from = addDays(today, -14); }
  else if (/\b(week|hafta|hafte)\b|हफ्ते|सप्ताह/.test(lower)) { requested = 7; from = addDays(today, -7); }
  else if (/\bthis month\b/.test(lower)) { from = `${today.slice(0, 8)}01`; requested = Number(today.slice(8)) - 1; }
  const clamped = requested > maxDays || from < floor;
  if (from < floor) from = floor;
  return { from, to, clamped };
}
const clean = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[.,!?;:"“”]/g, ' ').replace(/\s+/g, ' ').trim();

export function interpretVoice(raw: string, opts: { allowOffTopic?: boolean } = {}): VoiceIntent | null {
  const lower = clean(raw); if (!lower) return null;
  const core = lower.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();

  // Utility commands
  if (/^(?:go\s+)?back$|^previous page$|^peeche jao$|^वापस जाओ$|^पीछे जाओ$/.test(core)) return { kind: 'back' };

  // Read-only questions stay with the analytical assistant (it needs periods/filters/context).
  const isQuestion = QUESTION.test(lower) && !NAV_VERB.test(lower);

  // Data-changing / form-opening actions
  const mentionsExpense = /\bexpenses?\b|\bkharch[ae]?\b|खर्च/.test(lower);
  const mentionsInvoice = /\binvoices?\b|\bbill\b|इनवॉइस|इन्वॉइस|बिल/.test(lower);
  const mentionsJournal = /\bjournal\b|\btransactions?\b|लेनदेन/.test(lower);
  if (!isQuestion && CREATE_VERB.test(lower)) {
    if (mentionsInvoice) {
      const parsed = parseInvoiceVoice(raw.replace(/^.*?(?=\b(?:create|make|add|new|generate|raise)\b)/i, ''));
      if (parsed && parsed.params.customer && parsed.params.amount) return { kind: 'action', action: parsed };
      return { kind: 'navigate', path: '/invoices?add=1', label: 'a new invoice form' };
    }
    if (mentionsExpense) {
      const amount = lower.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(lakh|lac|crore|thousand|hazaar|hazar|k)?/);
      const action = routeVoiceCommand(lower.replace(/\b(a|an|the)\s+/g, '').replace(/\b(new|record|log|create|enter|make)\b/, 'add').replace(/\bexpense\s+(?:of\s+)?(?:for\s+)?/, 'expense '));
      if (action?.action === 'add_expense') return { kind: 'action', action };
      const qs = new URLSearchParams({ add: '1' });
      if (amount) { const mult = amount[2] === 'lakh' || amount[2] === 'lac' ? 100000 : amount[2] === 'crore' ? 1e7 : amount[2] ? 1000 : 1; qs.set('amount', String(Number(amount[1]) * mult)); }
      return { kind: 'navigate', path: `/expenses?${qs}`, label: 'a new expense form' };
    }
    if (mentionsJournal || /\bentry\b/.test(lower)) return { kind: 'navigate', path: '/journal?add=1', label: 'a new journal entry' };
    if (/\bcustomers?\b|\bclients?\b|ग्राहक/.test(lower)) return { kind: 'navigate', path: '/customers?add=1', label: 'a new customer form' };
    if (/\breceipt\b|रसीद/.test(lower)) return { kind: 'navigate', path: '/receipt-scanner', label: 'the receipt scanner' };
  }
  const wantsDownload = /\b(download|downloads|export|save|get|pdf|print|nikalo|nikaalo)\b|डाउनलोड|पीडीएफ/.test(lower);
  if (/\bstatements?\b|स्टेटमेंट/.test(lower) && !(isQuestion && !wantsDownload)) {
    const r = parseStatementRange(lower);
    const bank = (lower.match(/\b(hdfc|icici|sbi|axis|kotak|yes bank|idfc|pnb|bob|canara|federal)\b/) ?? [])[1] ?? '';
    const params = { from: r.from, to: r.to, clamped: r.clamped ? '1' : '', bank };
    if (wantsDownload) return { kind: 'action', action: { action: 'download_statement', params } };
    // "check / show my statements": open the statement dialog already filtered to the requested days.
    return { kind: 'navigate', path: `/bank?statement=1&from=${r.from}&to=${r.to}`, label: `your statement for ${r.from} to ${r.to}` };
  }
  if (wantsDownload && mentionsInvoice && !isQuestion) {
    const num = lower.match(/\binv\w*[-\s]*(\d{4})[-\s]*(\d{1,4})\b/);
    const cust = raw.match(/\b(?:for|of|to)\s+([A-Z][\p{L}0-9&.' -]{1,40}?)(?=\s+(?:as|in|invoice|pdf|please)\b|[.,!?]?$)/u);
    return { kind: 'action', action: { action: 'download_invoice', params: { invoice: num ? `INV-${num[1]}-${num[2]!.padStart(3, '0')}` : '', customer: cust?.[1]?.trim() ?? '', all: /\b(all|every)\b/.test(lower) ? '1' : '' } } };
  }
  if (/\bmark\s+inv/.test(lower)) { const a = routeVoiceCommand(lower); if (a) return { kind: 'action', action: a }; }
  if (/\b(dark mode|light mode|dark theme|light theme|toggle theme|change theme|switch theme)\b/.test(lower)) { const a = routeVoiceCommand(lower.includes('theme') || lower.includes('mode') ? 'toggle theme' : lower); if (a) return { kind: 'action', action: a }; }
  if (/\blanguage\b/.test(lower) && /\b(change|switch|set|use|speak)\b/.test(lower)) {
    const l = lower.match(/\b(english|hindi|hinglish)\b/) ?? raw.match(/(हिन्दी|हिंदी)/);
    if (l) return { kind: 'action', action: { action: 'change_language', params: { language: /hindi|हिन्दी|हिंदी/.test(l[1]!) ? 'hi' : l[1] === 'hinglish' ? 'hinglish' : 'en' } } };
  }
  const search = lower.match(/^(?:search(?: for)?|find|look up|lookup|dhundo|khojo)\s+(.+)$/);
  if (search) return { kind: 'action', action: { action: 'search', params: { query: search[1]!.replace(FILLER, ' ').trim() } } };

  // Navigation (optionally with a filter)
  if (!isQuestion || NAV_VERB.test(lower)) {
    const mod = findModule(core);
    const bareModule = mod && core.split(' ').length <= 4; // "expenses", "invoices page", "cash forecast"
    if (mod && (NAV_VERB.test(lower) || bareModule || /\b(module|page|section)\b/.test(lower))) {
      let path = mod.path; let label = mod.label;
      if (mod.path === '/invoices') {
        const f = /\b(overdue|late)\b|ओवरड्यू/.test(lower) ? 'Overdue' : /\b(unpaid|outstanding|pending|due|baaki|baki)\b|बकाया|बाकी/.test(lower) ? 'Pending,Overdue' : /\bpaid\b/.test(lower) ? 'Paid' : /\bdraft\b/.test(lower) ? 'Draft' : '';
        if (f) { path = `/invoices?status=${f}`; label = `${f.includes(',') ? 'unpaid' : f.toLowerCase()} invoices`; }
      }
      if (mod.path === '/reports') { const tab = REPORT_TABS.find(([re]) => re.test(lower)); if (tab) { path = `/reports?tab=${tab[1]}`; label = tab[2]; } }
      return { kind: 'navigate', path, label };
    }
    const tab = REPORT_TABS.find(([re]) => re.test(lower));
    if (tab && NAV_VERB.test(lower)) return { kind: 'navigate', path: `/reports?tab=${tab[1]}`, label: tab[2] };
  }

  if (!opts.allowOffTopic && !isFinovaRelated(raw)) return { kind: 'offtopic' };
  return null;
}

const EXPLICIT = new RegExp(`${NAV_VERB.source}|${CREATE_VERB.source}|\\b(download|export|search|find|mark|switch|change|go back)\\b|dark mode|light mode`, 'i');
/**
 * True only for an unmistakable command ("open expenses", "create invoice for Apex 20000").
 * Lets hands-free voice act without the wake word while ignoring ordinary speech that merely mentions a module.
 */
export function isExplicitCommand(text: string) {
  const r = interpretVoice(text, { allowOffTopic: false });
  return !!r && r.kind !== 'offtopic' && EXPLICIT.test(clean(text));
}

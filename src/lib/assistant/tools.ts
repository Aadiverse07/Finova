import { z } from 'zod';
import type { Workspace } from './engine';

export const assistantActionSchema = z.object({
  action: z.enum(['query_expenses','query_income','query_outstanding','query_profit','open_module','search','show_forecast','toggle_theme','change_language','add_expense','create_invoice_draft','mark_invoice_paid','scan_receipt','download_statement','download_invoice']),
  params: z.record(z.string(), z.string()).default({}),
});
export type AssistantAction = z.infer<typeof assistantActionSchema>;

const moneyNumber = (text: string) => {
  const cleaned = text.replace(/,/g, '');
  const lakh = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac)/i); if (lakh) return Number(lakh[1]) * 100000;
  const crore = cleaned.match(/(\d+(?:\.\d+)?)\s*crore/i); if (crore) return Number(crore[1]) * 10000000;
  const thousand = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:thousand|hazaar|hazar|hajar|k\b|हज़ार|हजार)/i); if (thousand) return Number(thousand[1]) * 1000;
  return Number(cleaned.match(/\d+(?:\.\d+)?/)?.[0] ?? 0);
};

const NOT_A_CUSTOMER = new Set(['me', 'myself', 'mujhe', 'mere', 'meri', 'mera', 'my', 'ek', 'a', 'an', 'the', 'new', 'naya', 'nayi', 'koi', 'one', 'invoice', 'bill']);
/** "create invoice for Apex 20000", "Apex ke liye 20 hazaar ka invoice banao", "अपेक्स के लिए 5000 का इनवॉइस बनाओ" */
export function parseInvoiceVoice(text: string): AssistantAction | null {
  const original = text.normalize('NFKC').trim(); const lower = original.toLowerCase();
  if (!/\b(invoice|invoices|bill)\b|इनवॉइस|इन्वॉइस|बिल/.test(lower)) return null;
  if (!/\b(create|make|generate|raise|new|add|banao|bana|banaiye|banado|karo|kardo|chahiye)\b|बनाओ|बनाइए|बना दो|बनाना|क्रिएट/.test(lower)) return null;
  if (/\b(nahi|nahin|not|can'?t|cannot|kitn[aie]|kya|how|which|kaun|kab|paid|unpaid|overdue|show|list|dikhao|dikhaao)\b|क्या|कितन|नहीं/.test(lower)) return null;
  const amountMatch = lower.replace(/,/g, '').match(/(?:₹|rs\.?\s*|rupees?\s*)?(\d+(?:\.\d+)?)\s*(?:lakh|lac|crore|thousand|hazaar|hazar|hajar|k\b|हज़ार|हजार)?/);
  const amount = amountMatch ? moneyNumber(amountMatch[0]) : 0;
  const stopAt = '(?=\\s+(?:of|worth|amount|for|rs\\.?|₹|rupees?|rupaye|due|dated?|with|ka|ki|ke|का|की|के|\\d)|\\s*$)';
  const patterns = [
    new RegExp(`\\bfor\\s+(.+?)${stopAt}`, 'iu'),
    new RegExp(`(?:^|\\s)([\\p{L}][\\p{L}\\p{M}0-9 .&'-]{1,60}?)\\s+(?:ke\\s+liye|के\\s+लिए|ko)(?=\\s|$)`, 'iu'),
  ];
  let customer = '';
  for (const re of patterns) {
    const m = original.match(re); if (!m) continue;
    let name = m[1]!.replace(/^(?:(?:create|make|generate|raise|an?|ek|new|naya|nayi|invoice|bill|banao|karo|please|plz)\s+)+/i, '').replace(/\s+(?:invoice|bill|banao|karo|create)$/i, '').trim();
    name = name.replace(/\s*(?:₹|rs\.?)?\s*\d[\d,.]*\s*(?:lakh|lac|crore|thousand|hazaar|hazar|k)?\s*$/i, '').trim();
    if (name && !NOT_A_CUSTOMER.has(name.toLowerCase())) { customer = name; break; }
  }
  if (customer && customer === customer.toLowerCase() && /^[a-z]/.test(customer)) customer = customer.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  const params: Record<string, string> = {};
  if (customer) params.customer = customer;
  if (amount > 0) params.amount = String(amount);
  return { action: 'create_invoice_draft', params };
}

/** Pick the closest existing customer for a spoken name, otherwise keep what was said. */
export function matchCustomerName(spoken: string, known: string[]) {
  const s = spoken.trim().toLowerCase(); if (!s) return spoken.trim();
  const exact = known.find((k) => k.toLowerCase() === s); if (exact) return exact;
  const partial = known.filter((k) => k.toLowerCase().includes(s) || (s.length >= 4 && s.includes(k.toLowerCase())));
  return partial.length === 1 ? partial[0]! : spoken.trim();
}

export function routeVoiceCommand(text: string): AssistantAction | null {
  const q = text.normalize('NFKC').trim(); const lower = q.toLowerCase();
  if (/\b(unpaid|outstanding|baaki|बकाया|बाकी)\b.*\b(invoice|invoices|इनवॉइस)\b/.test(lower)) return { action: 'query_outstanding', params: { scope: 'invoices' } };
  const invoiceCmd = parseInvoiceVoice(q); if (invoiceCmd) return invoiceCmd;
  // Keep natural-language financial questions on Brain #1 so periods, customer context and filters are preserved.
  if (/\b(open|show|go to|kholo|दिखाओ)\b.*\b(forecast|cash forecast|पूर्वानुमान)\b/.test(lower)) return { action: 'show_forecast', params: {} };
  const moduleMatch = lower.match(/\b(?:open|go to|kholo|जाएं|खोलो)\s+(dashboard|journal|transactions|invoices|expenses|reports|accounts|customers|banking|bank|forecast)\b/);
  if (moduleMatch) return { action: 'open_module', params: { module: moduleMatch[1] ?? '' } };
  if (/\b(scan|scanning|receipt|रसीद)\b/.test(lower)) return { action: 'scan_receipt', params: {} };
  if (/\b(dark mode|light mode|toggle theme|theme)\b/.test(lower)) return { action: 'toggle_theme', params: {} };
  const lang = lower.match(/\b(?:change|switch|set)\s+(?:ai\s+)?language\s+(?:to\s+)?(english|hindi|hinglish|हिन्दी|हिंदी)\b/);
  if (lang) return { action: 'change_language', params: { language: /hindi|हिन्दी|हिंदी/.test(lang[1]!) ? 'hi' : lang[1]!.startsWith('hing') ? 'hinglish' : 'en' } };
  const expense = lower.match(/\badd\s+(?:an?\s+)?expense\s+(?:of\s+)?(?:₹|rs\.?\s*)?([\d,]+(?:\.\d+)?)\s+(?:for\s+)?(.+?)(?:\s+category\s+([a-z &-]+))?(?:\s+today)?$/i);
  if (expense) return { action: 'add_expense', params: { amount: String(moneyNumber(expense[1]!)), vendor: expense[2]!.trim(), category: expense[3]?.trim() || 'Office Supplies' } };
  const paid = lower.match(/\bmark\s+(inv[-\s\w]+)\s+paid\b/);
  if (paid) return { action: 'mark_invoice_paid', params: { invoice: paid[1]!.trim() } };
  if (/\bsearch\b/.test(lower)) return { action: 'search', params: { query: q.replace(/^.*?search\s+/i, '').trim() } };
  return null;
}

export function actionNeedsConfirmation(action: AssistantAction['action']) {
  return ['add_expense','create_invoice_draft','mark_invoice_paid'].includes(action);
}

export function modulePath(name: string) {
  const key = name.toLowerCase();
  const paths: Record<string,string> = { dashboard:'/dashboard', journal:'/journal', transactions:'/journal', invoices:'/invoices', expenses:'/expenses', reports:'/reports', accounts:'/accounts', customers:'/customers', bank:'/bank', banking:'/bank', forecast:'/forecast' };
  return paths[key] ?? null;
}

export function pendingActionSummary(a: AssistantAction) {
  switch (a.action) {
    case 'add_expense': return `Add ₹${Number(a.params.amount ?? 0).toLocaleString('en-IN')} expense for ${a.params.vendor ?? 'vendor'}, category ${a.params.category ?? 'Office Supplies'}, today.`;
    case 'create_invoice_draft': return a.params.customer && a.params.amount ? `Create an invoice for ${a.params.customer} of ₹${Number(a.params.amount).toLocaleString('en-IN')}, due in 14 days.` : 'Open a new invoice form.';
    case 'mark_invoice_paid': return `Mark ${a.params.invoice ?? 'the selected invoice'} as paid.`;
    default: return 'Confirm this action.';
  }
}

export function executeReadAction(action: AssistantAction, ws: Workspace) {
  const totals = {
    expenses: ws.expenses.reduce((s, e) => s + e.amount, 0),
    income: ws.invoices.filter((i) => i.status === 'Paid' || i.status === 'Pending').reduce((s, i) => s + i.lines.reduce((a,l) => a + Number(l.quantity) * Number(l.unitPrice), 0) + i.tax - i.discount, 0),
    outstanding: ws.invoices.filter((i) => i.status !== 'Paid').reduce((s, i) => s + i.lines.reduce((a,l) => a + Number(l.quantity) * Number(l.unitPrice), 0) + i.tax - i.discount, 0),
  };
  if (action.action === 'query_expenses') return { text: `Recorded expenses total ₹${totals.expenses.toLocaleString('en-IN')}.`, intent: 'expenses' };
  if (action.action === 'query_income') return { text: `Recorded invoiced income total ₹${totals.income.toLocaleString('en-IN')}.`, intent: 'income' };
  if (action.action === 'query_outstanding') return { text: `Outstanding invoices total ₹${totals.outstanding.toLocaleString('en-IN')}.`, intent: 'outstanding' };
  if (action.action === 'query_profit') return { text: `Recorded revenue minus expenses is ₹${(totals.income - totals.expenses).toLocaleString('en-IN')}.`, intent: 'profit' };
  return null;
}

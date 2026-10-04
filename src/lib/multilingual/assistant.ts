import type { Workspace } from '@/lib/assistant/engine';
import { invoiceTotal } from '@/lib/data/calc';
import { normalizeFinancialQuery, type DetectedLanguage } from './normalizer';

type Answer = { answer: string; language: DetectedLanguage; intent: string; period: string; records?: unknown[]; followUps: string[] };
const money = (n: number) => `${n < 0 ? '-' : ''}₹${Math.abs(Math.round(n * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const monthName = (d: Date) => d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];

function periodFor(text: string, now = new Date()) {
  const source = text.toLowerCase();
  if (/\b(last|previous)\s+week\b|\bpichle\s+hafte\b|\bpichhle\s+hafte\b/.test(source)) {
    const end = startOfDay(now); const weekday = end.getDay(); const diff = weekday === 0 ? 6 : weekday - 1;
    end.setDate(end.getDate() - diff - 1);
    return { from: new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6), to: endOfDay(end), label: `${end.toLocaleDateString('en-IN',{month:'short',day:'numeric'})} – ${end.toLocaleDateString('en-IN',{month:'short',day:'numeric',year:'numeric'})}` };
  }
  if (/\b(this|current)\s+week\b|\bis\s+hafte\b|\biss\s+hafte\b/.test(source)) {
    const from = startOfDay(now); const weekday = from.getDay(); const diff = weekday === 0 ? 6 : weekday - 1; from.setDate(from.getDate() - diff);
    const to = new Date(from); to.setDate(to.getDate() + 6);
    return { from, to: endOfDay(to), label: `${from.toLocaleDateString('en-IN',{month:'short',day:'numeric'})} – ${to.toLocaleDateString('en-IN',{month:'short',day:'numeric',year:'numeric'})}` };
  }
  if (/\b(last|previous)\s+year\b|\bpichle\s+saal\b/.test(source)) {
    const y = now.getFullYear() - 1;
    return { from: new Date(y,0,1), to: new Date(y,11,31,23,59,59,999), label: String(y) };
  }
  if (/\b(this|current)\s+year\b|\bis\s+saal\b/.test(source)) {
    const y = now.getFullYear();
    return { from: new Date(y,0,1), to: new Date(y,11,31,23,59,59,999), label: String(y) };
  }
  if (/\b(financial year|fy|financial fiscal year)\b|\bfinancial\s+year\b|\bvit?tiya\s+varsh\b|\bवित्तीय\s+वर्ष\b/.test(source)) {
    const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return { from: new Date(y,3,1), to: new Date(y + 1,2,31,23,59,59,999), label: `FY ${String(y).slice(-2)}–${String(y + 1).slice(-2)}` };
  }
  const monthSource = source.replace(/\bmay\s+(i|we|you|be|have|not)\b/g, ' ');
  const explicitMonth = monthNames.findIndex((m) => new RegExp(`\\b${m}\\b`).test(monthSource));
  if (explicitMonth >= 0) {
    const year = explicitMonth > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
    const from = new Date(year, explicitMonth, 1); const to = new Date(year, explicitMonth + 1, 0, 23, 59, 59, 999);
    return { from, to, label: monthName(from) };
  }
  if (/\b(last|previous)\s+month\b|\bpichle\s+mahine\b|\bpichhle\s+mahine\b/.test(source)) {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { from: d, to: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999), label: monthName(d) };
  }
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to, label: monthName(now) };
}

const inRange = (date: string, p: { from: Date; to: Date }) => { const d = new Date(`${date}T00:00:00`); return d >= p.from && d <= p.to; };
const translated = (lang: DetectedLanguage, en: string, hi: string, hinglish: string) => lang === 'hi' ? hi : lang === 'hinglish' ? hinglish : en;

function customerNameFromQuestion(question: string) {
  const clean = question.replace(/[?।!]/g, ' ').replace(/\s+/g, ' ').trim();
  const possessive = clean.match(/(?:^|\s)([\p{L}][\p{L}\p{M}.'-]{1,50}(?:\s+[\p{L}][\p{L}\p{M}.'-]{1,50})?)\s+(?:का|की|के|ka|ki|ke)\s+(?:कितना|कितनी|कितने|बकाया|बाकी|outstanding|due|kitna|kitni|kitne|baaki|baki)(?![\p{L}\p{M}])/iu);
  if (possessive?.[1]) return possessive[1].trim();
  const afterLabel = clean.match(/(?:customer|grahak|ग्राहक)\s+([\p{L}][\p{L}\p{M} .'-]{1,80})/iu);
  return afterLabel?.[1]?.trim();
}

export function answerMultilingual(question: string, ws: Workspace): Answer {
  const { text, language } = normalizeFinancialQuery(question);
  const p = periodFor(text);
  const period = p.label;
  const expenses = ws.expenses.filter((e) => inRange(e.date, p));
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const income = ws.invoices.filter((i) => inRange(i.date, p) && i.status !== 'Draft').reduce((s, i) => s + invoiceTotal(i), 0);
  const todayDate = new Date();
  const overdue = ws.invoices.filter((i) => i.status !== 'Paid' && i.status !== 'Draft' && new Date(`${i.dueDate}T00:00:00`) < startOfDay(todayDate));
  const outstanding = ws.invoices.filter((i) => i.status !== 'Paid' && i.status !== 'Draft').reduce((s, i) => s + invoiceTotal(i), 0);
  const lower = text.toLowerCase();
  let answer = '';
  let intent = 'help';
  if (/(outstanding|overdue|customer|बकाया|बाकी|ग्राहक)/.test(lower) && /(how much|show|customer|कितना|कितनी|बकाया|बाकी|किसका)/.test(lower)) {
    intent = 'outstanding';
    const name = customerNameFromQuestion(question);
    if (name) {
      const needle = name.toLowerCase();
      const matches = ws.invoices.filter((i) => i.customer.toLowerCase().includes(needle) && i.status !== 'Paid' && i.status !== 'Draft');
      const value = matches.reduce((s, i) => s + invoiceTotal(i), 0);
      answer = translated(language, `${name} has ${money(value)} outstanding.`, `${name} का ${money(value)} बकाया है।`, `${name} ka ${money(value)} baaki hai.`);
    } else answer = translated(language, `Your total outstanding is ${money(outstanding)}. ${overdue.length} invoice(s) are overdue.`, `आपका कुल बकाया ${money(outstanding)} है। ${overdue.length} इनवॉइस की भुगतान तारीख निकल चुकी है।`, `Aapka total outstanding ${money(outstanding)} hai. ${overdue.length} invoice overdue hain.`);
  } else if (/total expense|expense|spent|खर्च/.test(lower)) {
    intent = 'expenses';
    const byCategory = new Map<string, number>(); expenses.forEach((e) => byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount));
    const top = [...byCategory.entries()].sort((a,b)=>b[1]-a[1])[0];
    answer = translated(language, `Your total expense for ${period} is ${money(expenseTotal)}. ${top ? `Highest category: ${top[0]} (${money(top[1])}).` : 'No expenses were recorded.'}`, `${period} में आपका कुल खर्च ${money(expenseTotal)} है। ${top ? `सबसे ज्यादा खर्च ${top[0]} पर ${money(top[1])} हुआ।` : 'कोई खर्च दर्ज नहीं है।'}`, `${period} mein aapka total kharcha ${money(expenseTotal)} hai. ${top ? `Sabse zyada ${top[0]} par ${money(top[1])} kharcha hua.` : 'Koi expense record nahi hai.'}`);
  } else if (/income|revenue|sales|kamai|aamdani|आमदनी|आय/.test(lower)) {
    intent = 'income';
    answer = translated(language, `Your invoiced income for ${period} is ${money(income)}.`, `${period} में आपके इनवॉइस की कुल आय ${money(income)} है।`, `${period} mein aapki invoiced income ${money(income)} hai.`);
  } else if (/profit|munafa|मुनाफा|लाभ/.test(lower)) {
    intent = 'profit';
    const profit = income - expenseTotal;
    answer = translated(language, `Recorded revenue minus expenses for ${period} is ${money(profit)}.`, `${period} में दर्ज आय में से खर्च घटाने पर ${money(profit)} बचता है।`, `${period} mein income minus expenses ${money(profit)} hai.`);
  } else {
    answer = translated(language, 'I can answer total expenses, income, outstanding balances and recorded profit. Try: “How much did I spend this month?”', 'मैं कुल खर्च, आय, बकाया और दर्ज लाभ बता सकता हूँ। जैसे: “इस महीने मेरा कुल खर्च कितना है?”', 'Main total kharcha, income, outstanding aur profit bata sakta hoon. Jaise: “Iss mahine mera total kharcha kitna hai?”');
  }
  return { answer, language, intent, period, followUps: language === 'hi' ? ['इस महीने का कुल खर्च कितना है?', 'मेरी कुल आय कितनी है?', 'मेरा कुल बकाया कितना है?'] : language === 'hinglish' ? ['Iss mahine ka total kharcha kitna hai?', 'Meri total income kitni hai?', 'Mera total baaki kitna hai?'] : ['How much did I spend this month?', 'What is my total income?', 'How much is outstanding?'] };
}

export { periodFor, customerNameFromQuestion };

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bot, Check, Mic, Pause, Play, RotateCcw, Send, Sparkles, Square, Volume2, VolumeX, X } from 'lucide-react';
import { useFinova } from '@/lib/data/store';
import { useCustomers } from '@/lib/customers/store';
import { nextInvoiceNumber } from '@/lib/data/calc';
import { addDays, todayISO, uid } from '@/lib/data/format';
import { stripWakePrefix } from '@/lib/voice/aliases';
import { answerQuestion, STARTER_QUESTIONS } from '@/lib/assistant/engine';
import { interpretVoice } from '@/lib/assistant/voice-intents';
import { useBank } from '@/lib/bank/store';
import { downloadStatementPdf } from '@/lib/pdf/statement-pdf';
import { downloadInvoicePdf } from '@/lib/pdf/invoice-pdf';
import { invoiceTotal } from '@/lib/data/calc';
import { answerMultilingual } from '@/lib/multilingual/assistant';
import { matchCustomerName, routeVoiceCommand, executeReadAction, actionNeedsConfirmation, modulePath, pendingActionSummary, type AssistantAction } from '@/lib/assistant/tools';
import { useI18n } from '@/lib/i18n';
import { LANGUAGES, type Language } from '@/lib/i18n/translations';
import { useAssistantChat } from '@/lib/assistant/chat-store';
import { useEscape } from '@/lib/use-escape';
import { AI_RATE_LIMIT, consumeLocalAiRateLimit, remainingLocalAiRateLimit } from '@/lib/ai-rate-limit';
import { resumeWakeListening, speakVoice, suspendWakeListening } from '@/lib/voice/wake-word';
import { auditVoiceMutation, cloneWorkspaceForUndo } from '@/lib/voice/audit';
import { useThemeSwitch } from '@/components/theme-toggle';
import { useSession } from '@/lib/demo-auth';


type RecEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type Recognition = { continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: RecEvent) => void) | null; onerror: ((e: { error?: string }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void; abort: () => void };
type RecWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const sanitize = (t: string) => t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, 1000);
const speakable = (t: string) => t.replace(/₹\s?([\d,]+(?:\.\d+)?)/g, '$1 rupees').replace(/[•✅⚠️…]/g, '').replace(/\n+/g, '. ').replace(/\s+/g, ' ').trim();
const aiLanguageKey = 'finova-ai-language';
const autoRunKey = 'finova-voice-autorun';

export function FinancialAssistant() {
  const router = useRouter();
  const { language, setLanguage, t } = useI18n();
  const { isDark, toggle: toggleTheme } = useThemeSwitch();
  const { user } = useSession();
  const { open, messages, speakReplies, setOpen, push, setContext, setSpeakReplies, reset } = useAssistantChat();
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [aiLanguage, setAiLanguage] = useState<Language | 'auto'>('en');
  const rateKeyRef = useRef('assistant');
  const [rate, setRate] = useState(remainingLocalAiRateLimit(rateKeyRef.current));
  useEffect(() => {
    const existing = localStorage.getItem('finova-device-id') ?? (() => { const id = crypto.randomUUID(); localStorage.setItem('finova-device-id', id); return id; })();
    rateKeyRef.current = user?.id ? `user:${user.id}` : `device:${existing}`;
    setRate(remainingLocalAiRateLimit(rateKeyRef.current));
  }, [user?.id]);
  const [pending, setPending] = useState<AssistantAction | null>(null);
  const [pendingTranscript, setPendingTranscript] = useState('');
  const [undoWorkspace, setUndoWorkspace] = useState<ReturnType<typeof cloneWorkspaceForUndo> | null>(null);
  const [undoText, setUndoText] = useState('');
  // One-time consent: once granted, Finova carries out voice commands (including data changes, with Undo) without asking again.
  const [autoRun, setAutoRun] = useState(false);
  const autoRunRef = useRef(false); autoRunRef.current = autoRun;
  useEffect(() => { try { setAutoRun(localStorage.getItem(autoRunKey) === 'granted'); } catch { /* storage unavailable */ } }, []);
  const grantAutoRun = () => { setAutoRun(true); autoRunRef.current = true; try { localStorage.setItem(autoRunKey, 'granted'); } catch { /* ignore */ } };


  const rec = useRef<Recognition | null>(null);
  // Hands-free conversation state
  const converseRef = useRef(false); const busyRef = useRef(false); const idleTicks = useRef(0);
  const silenceTimer = useRef<number | null>(null); const idleTimer = useRef<number | null>(null);
  const pendingRef = useRef<AssistantAction | null>(null); const confirmRef = useRef<(yes: boolean, action?: AssistantAction, transcript?: string) => void>(() => {});
  const prevSpeaking = useRef(false); const startVoiceRef = useRef<(auto?: boolean) => void>(() => {});
  pendingRef.current = pending;
  const wantListening = useRef(false); const committed = useRef(''); const fullText = useRef(''); const sendOnEnd = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null); const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { const stored = localStorage.getItem(aiLanguageKey) as Language | 'auto' | null; const valid = stored === 'auto' || LANGUAGES.some((x) => x.code === stored); setAiLanguage(valid && stored ? stored : language); }, []);
  useEffect(() => { if (!localStorage.getItem(aiLanguageKey)) setAiLanguage(language); }, [language]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, open]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { const handler = (event: Event) => { const detail = (event as CustomEvent<string>).detail; if (detail) { setOpen(true); setInput(detail); } }; window.addEventListener('finova:assistant-question', handler); return () => window.removeEventListener('finova:assistant-question', handler); }, [setOpen]);
  useEffect(() => { if (!listening) return; const timer = window.setInterval(() => setElapsed((s) => s + 1), 1000); return () => window.clearInterval(timer); }, [listening]);
  useEffect(() => { const tick = window.setInterval(() => setRate(remainingLocalAiRateLimit(rateKeyRef.current)), 1000); return () => window.clearInterval(tick); }, []);

  const recognitionLanguage = (aiLanguage === 'auto' ? language : aiLanguage) === 'hi' ? 'hi-IN' : 'en-IN';
  const stopSpeaking = useCallback(() => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); setSpeaking(false); }, []);
  const speak = useCallback((text: string, langOverride?: Language) => { const lang = langOverride ?? (aiLanguage === 'auto' ? language : aiLanguage); speakVoice(speakable(text), lang, setSpeaking); }, [aiLanguage, language]);

  const setAiLang = (next: Language | 'auto') => { setAiLanguage(next); localStorage.setItem(aiLanguageKey, next); if (next !== 'auto') setLanguage(next); };

  const showRateLimit = useCallback((resetAt: number, viaVoice = false) => {
    const seconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    const text = t('assistant.rateLimited').replace('{seconds}', String(seconds));
    push({ role: 'assistant', text }); if (viaVoice) speak(text);
  }, [push, speak, t]);

  const executeAction = useCallback((action: AssistantAction, source = 'voice', transcript = '') => {
    const s = useFinova.getState(); const ws = { accounts: s.accounts, entries: s.entries, invoices: s.invoices, expenses: s.expenses };
    if (action.action === 'create_invoice_draft' && !(action.params.customer && action.params.amount)) { router.push('/invoices?add=1'); push({ role: 'assistant', text: t('voice.invoiceDraftOpened') }); speak(t('voice.invoiceDraftOpened')); return; }
    if (actionNeedsConfirmation(action.action)) { if (autoRunRef.current) { confirmRef.current(true, action, source === 'voice' ? transcript : ''); return; } setPending(action); const text = pendingActionSummary(action); setPendingTranscript(source === 'voice' ? transcript : ''); push({ role: 'assistant', text: `${text} ${t('voice.confirmPrompt')}` }); speak(`${text} ${t('voice.confirmPrompt')}`); return; }
    if (action.action === 'download_statement') {
      const bank = useBank.getState(); bank.seedSandbox(); const b = useBank.getState();
      const hint = (action.params.bank ?? '').toLowerCase(); const acct = hint ? b.accounts.find((a) => a.bankName.toLowerCase().includes(hint)) : undefined;
      const from = action.params.from ?? ''; const to = action.params.to ?? '';
      const count = b.transactions.filter((x) => (!acct || x.accountId === acct.id) && x.date.slice(0, 10) >= from && x.date.slice(0, 10) <= to).length;
      downloadStatementPdf({ transactions: b.transactions, accounts: b.accounts, accountId: acct?.id ?? '', from, to });
      const text = `Your statement for ${from} to ${to}${acct ? ` (${acct.bankName})` : ''} is downloading as a PDF (${count} transaction${count === 1 ? '' : 's'}).${action.params.clamped ? ' Statements are limited to the last 30 days.' : ''}`;
      push({ role: 'assistant', text }); speak(text); setOpen(false); return;
    }
    if (action.action === 'download_invoice') {
      const list = useFinova.getState().invoices; const num = (action.params.invoice ?? '').toLowerCase(); const cust = (action.params.customer ?? '').toLowerCase();
      let pool = list; if (num) pool = list.filter((i) => i.number.toLowerCase() === num); else if (cust) pool = list.filter((i) => i.customer.toLowerCase().includes(cust));
      pool = [...pool].sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
      if (!pool.length) { const text = num ? `I could not find invoice ${action.params.invoice}.` : cust ? `I could not find any invoice for ${action.params.customer}.` : 'There are no invoices yet.'; push({ role: 'assistant', text }); speak(text); return; }
      const picks = action.params.all ? pool.slice(0, 10) : pool.slice(0, 1);
      picks.forEach((inv, k) => window.setTimeout(() => downloadInvoicePdf(inv), k * 400));
      const text = picks.length === 1 ? `Invoice ${picks[0]!.number} for ${picks[0]!.customer}, ₹${invoiceTotal(picks[0]!).toLocaleString('en-IN')}, is downloading as a PDF.` : `Downloading ${picks.length} invoice PDFs.`;
      push({ role: 'assistant', text }); speak(text); setOpen(false); return;
    }
    if (action.action === 'open_module' || action.action === 'show_forecast' || action.action === 'scan_receipt') { const path = action.action === 'show_forecast' ? '/forecast' : action.action === 'scan_receipt' ? '/receipt-scanner' : modulePath(action.params.module ?? ''); if (path) { router.push(path); push({ role: 'assistant', text: t('assistant.navigationComplete') }); if (source === 'voice') speak(t('assistant.navigationComplete')); } return; }
    if (action.action === 'toggle_theme') { toggleTheme(); const text = t('assistant.themeChanged').replace('{mode}', isDark ? 'light' : 'dark'); push({ role: 'assistant', text }); speak(text); return; }
    if (action.action === 'change_language') { const lang = action.params.language as Language; if (lang === 'en' || lang === 'hi' || lang === 'hinglish') { setAiLang(lang); const text = t('assistant.languageChanged'); push({ role: 'assistant', text }); speakVoice(text, lang, setSpeaking); } return; }
    if (action.action === 'search') { window.dispatchEvent(new CustomEvent('finova:global-search', { detail: action.params.query ?? '' })); setOpen(false); return; }
    const direct = executeReadAction(action, ws); if (direct) { push({ role: 'assistant', text: direct.text }); if (source === 'voice') speak(direct.text); }
  }, [isDark, push, router, setAiLang, setOpen, speak, t, toggleTheme]);

  const ask = useCallback(async (question: string, viaVoice = false, fromWake = false) => {
    const q = sanitize(question.trim()); if (!q || q.length > 1000) return;
    stopSpeaking(); push({ role: 'user', text: q }); setInput('');
    if (!viaVoice) converseRef.current = false;
    if (viaVoice) {
      const bare = stripWakePrefix(q);
      if (pendingRef.current) {
        const yes = /^(yes|yeah|yep|yup|confirm|confirmed|do it|go ahead|ok|okay|sure|haan|han|haa|हाँ|हां|ठीक है|कर दो)\W*$/i.test(bare);
        const no = /^(no|nope|cancel|don'?t|nahi|nahin|नहीं|मत करो|रद्द)\W*$/i.test(bare);
        if (yes || no) { confirmRef.current(yes); if (!converseRef.current) resumeWakeListening(); return; }
      }
      if (/^(stop|bye|goodbye|thanks|thank you|that'?s all|that is all|no thanks|band karo|bas|धन्यवाद|बस)\W*$/i.test(bare)) {
        converseRef.current = false; const bye = 'Okay, I will be here when you need me.'; push({ role: 'assistant', text: bye }); speak(bye); resumeWakeListening(); return;
      }
    }
    const spoken = stripWakePrefix(q);
    const handsFree = viaVoice || fromWake;
    const intent = interpretVoice(spoken, { allowOffTopic: !handsFree || !!useAssistantChat.getState().context || !!pendingRef.current });
    if (intent?.kind === 'back') { router.back(); if (handsFree) setOpen(false); if (!converseRef.current) resumeWakeListening(); return; }
    if (intent?.kind === 'navigate') {
      // Open the module straight away: no confirmation, no AI quota used.
      router.push(intent.path);
      const done = `Opening ${intent.label}.`; push({ role: 'assistant', text: done }); if (handsFree) { speak(done); setOpen(false); }
      converseRef.current = false; resumeWakeListening(); return;
    }
    if (intent?.kind === 'offtopic') {
      const msg = 'I can only help with Finova: invoices, expenses, transactions, banking, reports, customers and other modules of this website. Try "open expenses" or "create an invoice for Apex 20000".';
      push({ role: 'assistant', text: msg }); if (handsFree) speak(msg); if (!converseRef.current) resumeWakeListening(); return;
    }
    const directAction = intent?.kind === 'action' ? intent.action : routeVoiceCommand(spoken);
    if (directAction && (fromWake || viaVoice || intent?.kind === 'action') && ['open_module','show_forecast','toggle_theme','change_language','query_outstanding','search','scan_receipt','add_expense','create_invoice_draft','mark_invoice_paid','download_statement','download_invoice'].includes(directAction.action)) {
      // Navigation/read/write voice commands are handled by Finova's deterministic tools and
      // must not consume an AI query quota because no AI endpoint is called.
      executeAction(directAction, 'voice', q); if (!converseRef.current) resumeWakeListening(); return;
    }
    busyRef.current = viaVoice;
    const rateState = consumeLocalAiRateLimit(rateKeyRef.current); setRate(rateState);
    if (!rateState.allowed) { showRateLimit(rateState.resetAt, viaVoice); if (viaVoice && !converseRef.current) resumeWakeListening(); return; }
    const chat = useAssistantChat.getState(); const s = useFinova.getState(); const workspace = { accounts: s.accounts, entries: s.entries, invoices: s.invoices, expenses: s.expenses };
    const effectiveLang = aiLanguage === 'auto' ? language : aiLanguage;
    const multilingual = effectiveLang !== 'en' || /[\u0900-\u097F]/.test(q) || /\b(mera|meri|mere|ka|ki|ke|kitna|kharcha|kharch|baki|baaki|iss|mahine|pichle|batao|aamdani|kamai)\b/i.test(q);
    try {
      const endpoint = multilingual ? '/api/multilingual-assistant' : '/api/assistant';
      const deviceId = localStorage.getItem('finova-device-id') ?? (() => { const id = crypto.randomUUID(); localStorage.setItem('finova-device-id', id); return id; })();
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-finova-device-id': deviceId, ...(user?.id ? { 'x-finova-user-id': user.id } : {}) }, body: JSON.stringify({ question: q, language: effectiveLang, context: chat.context, workspace }) });
      const payload = await response.json().catch(() => null) as { success?: boolean; data?: { answer?: string; links?: { label: string; href: string }[]; followUps?: string[]; context?: { intent: string; question: string } }; error?: string } | null;
      const remainingHeader = response.headers.get('x-ratelimit-remaining'); if (remainingHeader) setRate((x) => ({ ...x, remaining: Number(remainingHeader) || 0 }));
      if (response.status === 429) { const resetAt = Number(response.headers.get('x-ratelimit-reset') ?? 0) * 1000 || Date.now() + AI_RATE_LIMIT.windowMs; showRateLimit(resetAt, viaVoice); return; }
      if (!response.ok || !payload?.success || !payload.data?.answer) throw new Error(payload?.error || t('assistant.requestFailed'));
      const reply = payload.data; if (reply.context) setContext(reply.context); push({ role: 'assistant', text: reply.answer, links: reply.links, followUps: reply.followUps }); if (viaVoice || chat.speakReplies) speak(reply.answer);
    } catch {
      const reply = multilingual ? answerMultilingual(q, workspace) : answerQuestion(q, workspace, { context: chat.context }); if ('context' in reply && reply.context) setContext(reply.context); push({ role: 'assistant', text: reply.answer, links: 'links' in reply ? reply.links : undefined, followUps: reply.followUps }); if (viaVoice || chat.speakReplies) { const replyLang = 'language' in reply ? reply.language : undefined; speak(reply.answer, replyLang === 'hi' ? 'hi' : replyLang === 'hinglish' ? 'hinglish' : 'en'); }
    } finally {
      busyRef.current = false; if (viaVoice && !converseRef.current) resumeWakeListening();
    }
  }, [aiLanguage, executeAction, language, push, router, setContext, setOpen, showRateLimit, speak, stopSpeaking, t, user?.id]);

  const resetVoice = useCallback(() => { if (silenceTimer.current) clearTimeout(silenceTimer.current); if (idleTimer.current) clearTimeout(idleTimer.current); silenceTimer.current = null; idleTimer.current = null; wantListening.current = false; sendOnEnd.current = false; committed.current = ''; fullText.current = ''; setListening(false); setPaused(false); setElapsed(0); }, []);
  const startVoice = useCallback((auto?: boolean) => {
    suspendWakeListening();
    const w = window as RecWindow; const Speech = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Speech) { push({ role: 'assistant', text: t('voice.unsupported') }); return; }
    stopSpeaking(); committed.current = ''; fullText.current = ''; sendOnEnd.current = false; wantListening.current = true; setElapsed(0);
    const r = new Speech(); r.continuous = true; r.interimResults = true; r.lang = recognitionLanguage;
    r.onresult = (e) => { const session = Array.from(e.results).map((x) => x[0]?.transcript ?? '').join('').trim(); fullText.current = `${committed.current} ${session}`.trim(); setInput(fullText.current); if (auto === true) { if (idleTimer.current) { clearTimeout(idleTimer.current); idleTimer.current = null; } if (silenceTimer.current) clearTimeout(silenceTimer.current); silenceTimer.current = window.setTimeout(() => { silenceTimer.current = null; if (!wantListening.current || !fullText.current.trim()) return; wantListening.current = false; sendOnEnd.current = true; try { r.stop(); } catch { sendOnEnd.current = false; } }, 1600); } };
    r.onerror = (e) => { if (e.error === 'no-speech' || e.error === 'aborted') return; resetVoice(); push({ role: 'assistant', text: e.error === 'not-allowed' || e.error === 'service-not-allowed' ? t('voice.micBlocked') : t('voice.stopped') }); };
    r.onend = () => { if (sendOnEnd.current) { const q = fullText.current.trim(); resetVoice(); rec.current = null; if (q) ask(q, true); else push({ role: 'assistant', text: t('voice.didNotCatch') }); return; } if (wantListening.current) { committed.current = fullText.current; try { r.start(); } catch { resetVoice(); } } };
    rec.current = r; setListening(true); setPaused(false); setInput(''); try { r.start(); } catch { resetVoice(); }
    if (auto === true) idleTimer.current = window.setTimeout(() => { idleTimer.current = null; if (fullText.current.trim() || !wantListening.current) return; converseRef.current = false; wantListening.current = false; sendOnEnd.current = false; try { r.abort(); } catch {} rec.current = null; resetVoice(); setInput(''); resumeWakeListening(); }, 9000);
  }, [ask, push, recognitionLanguage, resetVoice, stopSpeaking, t]);
  startVoiceRef.current = startVoice;
  // After Finova finishes speaking in a hands-free conversation, listen again for a follow-up.
  useEffect(() => { const was = prevSpeaking.current; prevSpeaking.current = speaking; if (was && !speaking && converseRef.current && !rec.current && open) startVoiceRef.current(true); }, [speaking, open]);
  // Watchdog: never leave the wake word suspended if a conversation stalls.
  useEffect(() => { const id = window.setInterval(() => { if (!converseRef.current) { idleTicks.current = 0; return; } if (speaking || rec.current || busyRef.current) { idleTicks.current = 0; return; } idleTicks.current += 1; if (idleTicks.current >= 3) { idleTicks.current = 0; converseRef.current = false; resumeWakeListening(); } }, 2000); return () => window.clearInterval(id); }, [speaking]);
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ command?: string }>).detail;
      const q = detail?.command?.trim();
      const quick = q ? interpretVoice(stripWakePrefix(q)) : null;
      // Plain navigation commands run without popping the chat open over the page the user asked for.
      if (!(quick && (quick.kind === 'navigate' || quick.kind === 'back'))) setOpen(true);
      converseRef.current = true;
      window.setTimeout(() => {
        if (q) { void ask(q, true, true); return; }
        const lang = aiLanguage === 'auto' ? language : aiLanguage;
        const greeting = lang === 'hi' ? 'नमस्ते! मैं आपकी कैसे मदद कर सकता हूँ?' : lang === 'hinglish' ? 'Hi! Main aapki kaise madad kar sakta hoon?' : 'Hi! How can I help you?';
        if ('speechSynthesis' in window) speakVoice(greeting, lang, setSpeaking); else startVoice(true);
      }, 60);
    };
    const errorHandler = (event: Event) => { setOpen(true); const detail = (event as CustomEvent<string>).detail; push({ role: 'assistant', text: detail || t('voice.stopped') }); };
    window.addEventListener('finova:wake', handler);
    window.addEventListener('finova:wake-error', errorHandler);
    return () => { window.removeEventListener('finova:wake', handler); window.removeEventListener('finova:wake-error', errorHandler); };
  }, [aiLanguage, ask, language, push, setOpen, startVoice, t]);

  const pauseOrResume = () => { const r = rec.current; if (!r) return; if (paused) { wantListening.current = true; committed.current = fullText.current; setPaused(false); setListening(true); try { r.start(); } catch {} } else { wantListening.current = false; committed.current = fullText.current; setPaused(true); setListening(false); r.stop(); } };
  const cancelVoice = () => { converseRef.current = false; wantListening.current = false; sendOnEnd.current = false; try { rec.current?.abort(); } catch {} rec.current = null; resetVoice(); setInput(''); resumeWakeListening(); };
  const finishVoice = () => { const r = rec.current; wantListening.current = false; if (paused || !listening) { const q = fullText.current.trim(); cancelVoice(); if (q) ask(q, true); return; } sendOnEnd.current = true; try { r?.stop(); } catch { sendOnEnd.current = false; } };
  const confirmPending = (yes: boolean, actionArg?: AssistantAction, transcriptArg?: string) => { const action = actionArg ?? pending; const transcript = transcriptArg ?? pendingTranscript; setPending(null); setPendingTranscript(''); if (!action) return; if (!yes) { auditVoiceMutation({ action: action.action, transcript, confirmed: false }); push({ role: 'assistant', text: t('voice.cancelled') }); speak(t('voice.cancelled')); return; } const s = useFinova.getState(); const before = cloneWorkspaceForUndo({ accounts: s.accounts, entries: s.entries, invoices: s.invoices, expenses: s.expenses }); auditVoiceMutation({ action: action.action, transcript, confirmed: true, entityId: action.params.invoice }); if (action.action === 'add_expense') { const amount = Number(action.params.amount ?? 0); const expense = s.addExpense({ date: new Date().toISOString().slice(0, 10), category: action.params.category ?? 'Office Supplies', vendor: action.params.vendor ?? 'Unknown vendor', description: 'Added by Finova voice assistant', amount, paymentMethod: 'Bank Transfer', status: 'Paid', notes: 'Voice command' }); setUndoWorkspace(before); setUndoText(`Added ₹${amount.toLocaleString('en-IN')} expense for ${expense.vendor}.`); push({ role: 'assistant', text: t('voice.expenseAdded').replace('{amount}', amount.toLocaleString('en-IN')).replace('{vendor}', expense.vendor) }); speak(t('voice.expenseAdded').replace('{amount}', `${amount.toLocaleString('en-IN')} rupees`).replace('{vendor}', expense.vendor)); } else if (action.action === 'mark_invoice_paid') { const target = s.invoices.find((i) => i.id.toLowerCase() === (action.params.invoice ?? '').toLowerCase() || i.number.toLowerCase() === (action.params.invoice ?? '').toLowerCase()); if (!target) { push({ role: 'assistant', text: t('voice.invoiceNotFound') }); return; } s.markInvoicePaid(target.id); setUndoWorkspace(before); setUndoText(`${target.number} is marked as paid.`); push({ role: 'assistant', text: t('voice.invoicePaid').replace('{invoice}', target.number) }); speak(t('voice.invoicePaid').replace('{invoice}', target.number)); } else if (action.action === 'create_invoice_draft') {
      const amount = Number(action.params.amount ?? 0); const spoken = (action.params.customer ?? '').trim();
      if (!spoken || !(amount > 0)) { router.push('/invoices?add=1'); push({ role: 'assistant', text: t('voice.invoiceDraftOpened') }); speak(t('voice.invoiceDraftOpened')); return; }
      const customers = useCustomers.getState().customers;
      const customer = matchCustomerName(spoken, [...new Set([...s.invoices.map((i) => i.customer), ...customers.map((c) => c.displayName)])]);
      const record = customers.find((c) => c.displayName.toLowerCase() === customer.toLowerCase() || c.legalName.toLowerCase() === customer.toLowerCase());
      const date = todayISO(); const dueDate = addDays(date, 14); const number = nextInvoiceNumber(s.invoices);
      s.saveInvoice({ id: '', number, customer, customerId: record?.id, date, dueDate, lines: [{ id: uid(), description: action.params.description || 'Services', quantity: '1', unitPrice: String(amount) }], tax: 0, discount: 0, status: 'Pending', notes: 'Created by Finova voice assistant' });
      setUndoWorkspace(before); setUndoText(`Created ${number} for ${customer}.`);
      const lang = aiLanguage === 'auto' ? language : aiLanguage; const shown = amount.toLocaleString('en-IN');
      const done = lang === 'hi' ? `${customer} के लिए ${number} इनवॉइस ${shown} रुपये का बन गया है। देय तिथि ${dueDate}।` : lang === 'hinglish' ? `${customer} ke liye invoice ${number}, ${shown} rupaye ka ban gaya hai. Due date ${dueDate} hai.` : `Invoice ${number} for ${customer}, ₹${shown}, is created and due on ${dueDate}.`;
      push({ role: 'assistant', text: done }); speak(done.replace(`₹${shown}`, `${shown} rupees`));
    } };
  confirmRef.current = confirmPending;

  useEscape(() => { if (useAssistantChat.getState().open) { cancelVoice(); stopSpeaking(); setOpen(false); } });
  useEffect(() => () => { try { rec.current?.abort(); } catch {} stopSpeaking(); }, [stopSpeaking]);
  const last = messages[messages.length - 1]; const voiceActive = listening || paused;
  const chips = messages.length === 1 ? (language === 'hi' ? ['इस महीने का कुल खर्च कितना है?', 'मेरी कुल आय कितनी है?', 'मेरा कुल बकाया कितना है?'] : language === 'hinglish' ? ['Iss mahine ka total kharcha kitna hai?', 'Meri total income kitni hai?', 'Mera total baaki kitna hai?'] : STARTER_QUESTIONS) : (last?.role === 'assistant' ? last.followUps ?? [] : []);
  const remainingText = t('assistant.remaining').replace('{remaining}', String(rate.remaining)).replace('{max}', String(AI_RATE_LIMIT.max));
  const aiLanguageLabel = t('language.aiLanguage');
  return <>
    {open && <div className="assistant-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) { cancelVoice(); stopSpeaking(); setOpen(false); } }}>
      <section className="assistant-panel" role="dialog" aria-modal="true" aria-labelledby="assistant-title">
        <header className="assistant-head"><div className="assistant-title"><span className="assistant-bot"><Bot size={18}/></span><div><h2 id="assistant-title">{t('assistant.title')}</h2><p>{t('assistant.subtitle')}</p></div></div>
          <div className="assistant-head-actions"><label className="ai-language-select"><span>{aiLanguageLabel}</span><select aria-label={aiLanguageLabel} value={aiLanguage} onChange={(e) => setAiLang(e.target.value as Language | 'auto')}><option value="auto">{t('assistant.autoDetect')}</option>{LANGUAGES.map((x) => <option key={x.code} value={x.code}>{x.nativeName}</option>)}</select></label><button type="button" className="icon-button" onClick={() => setSpeakReplies(!speakReplies)} aria-label={speakReplies ? t('assistant.mute') : t('assistant.speak')} title={speakReplies ? t('assistant.mute') : t('assistant.speak')}>{speakReplies ? <Volume2 size={17}/> : <VolumeX size={17}/>}</button><button type="button" className="icon-button" onClick={() => { reset(); setInput(''); }} aria-label={t('assistant.clear')}><RotateCcw size={17}/></button><button type="button" className="icon-button" onClick={() => { cancelVoice(); stopSpeaking(); setOpen(false); }} aria-label={t('assistant.close')}><X size={17}/></button></div></header>
        <div className="assistant-rate" role="status"><span>{remainingText}</span>{rate.remaining === 0 && <strong>{clock(Math.ceil((rate.resetAt - Date.now()) / 1000))}</strong>}</div>
        <div className="assistant-messages" ref={scrollRef}>{messages.map((m, i) => <div key={i} className={`assistant-message ${m.role}`}><div className="message-bubble">{m.text}</div>{m.links?.map((l) => <button key={l.href} className="assistant-link" onClick={() => router.push(l.href)}>{l.label}<ArrowRight size={13}/></button>)}{m.followUps?.map((q) => <button key={q} className="assistant-follow" onClick={() => ask(q)}>{q}</button>)}</div>)}</div>
        {undoWorkspace && <div className="assistant-undo" role="status"><span>{undoText}</span><button type="button" onClick={() => { useFinova.getState().replaceWorkspace(undoWorkspace); auditVoiceMutation({ action: 'undo_mutation', transcript: 'Undo voice mutation', confirmed: true }); setUndoWorkspace(null); setUndoText(''); push({ role: 'assistant', text: t('voice.undone') }); speak(t('voice.undone')); }}>Undo</button></div>}
        {pending && <div className="assistant-confirm" role="alert"><div><strong>{t('voice.confirmTitle')}</strong><p>{pendingActionSummary(pending)}</p></div><div><button type="button" className="primary-button" onClick={() => confirmPending(true)}><Check size={16}/> {t('voice.confirm')}</button>{!autoRun && <button type="button" className="secondary-button" onClick={() => { grantAutoRun(); confirmPending(true); }} title="Allow once, for every future voice command">Always allow</button>}<button type="button" className="secondary-button" onClick={() => confirmPending(false)}>{t('voice.cancel')}</button></div></div>}
        {chips.length > 0 && <div className="assistant-chips">{chips.slice(0, 4).map((q) => <button key={q} type="button" onClick={() => void ask(q)}>{q}</button>)}</div>}
        <div className="assistant-input"><textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(input); } }} placeholder={t('assistant.input')} aria-label={t('assistant.input')} rows={2}/><div className="assistant-input-actions">{voiceActive ? <><button type="button" onClick={pauseOrResume} className="assistant-voice-control" aria-label={paused ? t('voice.resume') : t('voice.pause')}>{paused ? <Play size={17}/> : <Pause size={17}/>}</button><button type="button" onClick={finishVoice} className="assistant-voice-control primary" aria-label={t('voice.send')}><Send size={17}/></button><button type="button" onClick={cancelVoice} className="assistant-voice-control" aria-label={t('voice.cancel')}><Square size={15}/></button><span className="assistant-clock">{clock(elapsed)}</span></> : <><button type="button" onClick={() => startVoice()} className="assistant-voice-control" aria-label={t('assistant.mic')} title={t('assistant.mic')}><Mic size={17}/></button><button type="button" className="assistant-send" onClick={() => void ask(input)} disabled={!input.trim() || rate.remaining === 0} aria-label={t('assistant.send')}><Send size={17}/></button></>}</div></div>
        <div className="assistant-foot">{t('assistant.review')} {speaking && <button type="button" onClick={() => { converseRef.current = false; stopSpeaking(); resumeWakeListening(); }}>{t('assistant.stopSpeaking')}</button>}</div>
      </section>
    </div>}
  </>;
}

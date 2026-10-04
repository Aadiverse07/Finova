import type { Workspace, AssistantReply, AssistantContext } from './engine';
import { env } from '@/lib/env';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_CONTEXT_CHARS = 120_000;

type GeminiResult = {
  answer: string;
  canAnswer: boolean;
  followUps?: string[];
};

type GeminiCandidate = { key: string; index: number };

function keys(): GeminiCandidate[] {
  const values = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
  ].map((v) => v?.trim()).filter((v): v is string => Boolean(v));

  // Backward compatibility with the project's previous single-key variable.
  if (!values.length && process.env.NL_SEARCH_LLM_API_KEY?.trim()) {
    values.push(process.env.NL_SEARCH_LLM_API_KEY.trim());
  }

  return values.map((key, i) => ({ key, index: i + 1 }));
}

function compactWorkspace(ws: Workspace) {
  return {
    accounts: ws.accounts,
    entries: ws.entries.slice(-250),
    invoices: ws.invoices.slice(-250),
    expenses: ws.expenses.slice(-250),
  };
}

function promptFor(question: string, ws: Workspace, language: string, context?: AssistantContext): string {
  const payload = JSON.stringify(compactWorkspace(ws));
  const contextText = context ? JSON.stringify(context) : 'none';
  const raw = `You are Finova's secondary financial assistant brain. The primary brain is a deterministic, pre-defined Finova logic engine. You are called ONLY when that engine could not confidently answer the user's question.

Rules:
- Answer only using the supplied Finova workspace data and the user's question.
- Never invent transactions, invoices, customers, amounts, dates, balances, or capabilities.
- If the supplied data is insufficient to answer, set canAnswer=false.
- If the question is outside personal/business finance, set canAnswer=false.
- Keep the answer concise, clear, and useful for a normal user.
- Reply in the user's language when possible. Requested/current UI language: ${language}.
- Do not claim to have performed an action. This assistant is read-only.
- Return ONLY valid JSON matching exactly: {"canAnswer":boolean,"answer":string,"followUps":string[]}

Previous context: ${contextText}
User question: ${question}
Workspace data: ${payload}`;
  return raw.length > MAX_CONTEXT_CHARS ? raw.slice(0, MAX_CONTEXT_CHARS) : raw;
}

function extractJson(text: string): GeminiResult | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const value = JSON.parse(cleaned) as Partial<GeminiResult>;
    if (typeof value.canAnswer !== 'boolean' || typeof value.answer !== 'string') return null;
    return {
      canAnswer: value.canAnswer,
      answer: value.answer.trim(),
      followUps: Array.isArray(value.followUps) ? value.followUps.filter((x): x is string => typeof x === 'string').slice(0, 5) : [],
    };
  } catch {
    return null;
  }
}

function isRetryable(status: number) {
  return status === 401 || status === 403 || status === 408 || status === 409 || status === 429 || status >= 500;
}

async function callGemini(key: string, question: string, ws: Workspace, language: string, context?: AssistantContext): Promise<GeminiResult> {
  const model = env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const timeoutMs = Math.min(Math.max(env.GEMINI_TIMEOUT_MS ?? env.NL_SEARCH_LLM_TIMEOUT_MS ?? 10000, 1000), 30000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: promptFor(question, ws, language, context) }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json', maxOutputTokens: 700 },
      }),
      cache: 'no-store',
    });
    if (!response.ok) {
      const message = await response.text().catch(() => '');
      const error = new Error(`Gemini request failed (${response.status})`);
      (error as Error & { status?: number }).status = response.status;
      (error as Error & { detail?: string }).detail = message.slice(0, 500);
      throw error;
    }
    const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const result = extractJson(text);
    if (!result) throw new Error('Gemini returned an invalid structured response.');
    return result;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Secondary brain: keys are deliberately tried sequentially, never concurrently.
 * A key is abandoned for this request when it expires, is rate/quota limited, errors,
 * times out, or Gemini explicitly says it cannot answer. The next key is then tried.
 */
export async function answerWithGeminiFallback(
  question: string,
  ws: Workspace,
  options: { language?: string; context?: AssistantContext } = {},
): Promise<{ reply: AssistantReply | null; attemptedKeys: number }> {
  if (!env.GEMINI_ENABLED) return { reply: null, attemptedKeys: 0 };

  const candidates = keys();
  let attemptedKeys = 0;
  for (const candidate of candidates) {
    attemptedKeys += 1;
    try {
      const result = await callGemini(candidate.key, question, ws, options.language ?? 'en', options.context);
      if (!result.canAnswer || !result.answer) continue;
      return {
        attemptedKeys,
        reply: {
          answer: result.answer,
          intent: 'gemini_fallback',
          inScope: true,
          followUps: result.followUps?.length ? result.followUps : undefined,
          context: { intent: 'gemini_fallback', question: question.slice(0, 300) },
        },
      };
    } catch (error) {
      const status = error instanceof Error ? (error as Error & { status?: number }).status : undefined;
      // Continue to the next key. Non-retryable failures are also isolated to this key;
      // the user's requirement is strict sequential failover, not parallel key usage.
      if (status !== undefined && !isRetryable(status)) continue;
    }
  }
  return { reply: null, attemptedKeys };
}

import { withOrgAuth } from '@/lib/api/withOrgAuth';
import { fail, ok } from '@/lib/api/response';
import { consumeAiRateLimit, rateLimitHeaders } from '@/lib/api/rateLimit';
import { writeAuditLog } from '@/lib/api/auditLog';
import { logger } from '@/lib/logger';
import { repositoryMode } from '@/lib/repo';
import { answerQuestion, isInScope, type AssistantContext, type Workspace } from '@/lib/assistant/engine';
import { answerWithGeminiFallback } from '@/lib/assistant/gemini-brain';

const EMPTY: Workspace = { accounts: [], entries: [], invoices: [], expenses: [] };

function isWorkspace(value: unknown): value is Workspace {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.accounts) && Array.isArray(v.entries) && Array.isArray(v.invoices) && Array.isArray(v.expenses);
}


function parseContext(v: unknown): AssistantContext | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const { intent, question } = v as Record<string, unknown>;
  return typeof intent === 'string' && typeof question === 'string' && question.length <= 400 ? { intent: intent.slice(0, 40), question } : undefined;
}

/**
 * Server-side twin of the in-browser assistant: same engine, same answers, but reading the caller's
 * organisation from Postgres. Success shape follows the platform envelope: { success, data: AssistantReply }.
 * No LLM is called; out-of-scope questions are refused BEFORE any database work happens.
 */
export const POST = withOrgAuth(async ({ orgId, userId }, req) => {
  let body: unknown;
  try { body = await req.json(); } catch { return fail('Request body must be valid JSON', 400); }
  const b = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  if (typeof b.question !== 'string' || !b.question.trim() || b.question.length > 1000) return fail('Enter a question of up to 1000 characters.', 400);
  const question = b.question.trim();

  const limited = await consumeAiRateLimit(userId || req.headers.get('x-finova-device-id') || 'anonymous');
  if (!limited.allowed) {
    logger.warn({ event: 'ai_rate_limit_hit', userId, orgId }, 'AI rate limit exceeded');
    await writeAuditLog({ orgId, actorId: userId, action: 'SECURITY', entityType: 'AI_RATE_LIMIT', entityId: 'ai', reason: 'AI rate limit exceeded', ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined, userAgent: req.headers.get('user-agent') ?? undefined });
    return new Response(JSON.stringify({ success: false, error: 'Too many AI queries. Please wait before asking again.' }), { status: 429, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(limited) } });
  }

  const context = parseContext(b.context);
  let workspace: Workspace = EMPTY;
  if (repositoryMode() === 'prisma') {
    const { loadWorkspace } = await import('@/lib/assistant/prisma-workspace');
    workspace = await loadWorkspace(orgId);
  } else if (isWorkspace(b.workspace)) {
    // Demo mode uses the same workspace currently rendered in the browser.
    // It is never trusted for Prisma-backed requests.
    workspace = b.workspace;
  }

  // Brain #1: existing deterministic Finova logic. Gemini is never called when this brain answers.
  const primary = answerQuestion(question, workspace, { context });
  const primarySolved = primary.inScope && primary.intent !== 'clarify' && primary.intent !== 'empty';
  if (primarySolved || !isInScope(question)) return ok(primary);

  // Brain #2: Gemini, invoked only when Brain #1 could not solve the query.
  const gemini = await answerWithGeminiFallback(question, workspace, { language: typeof b.language === 'string' ? b.language : 'en', context });
  if (gemini.reply) return ok(gemini.reply);
  return ok(primary);
});

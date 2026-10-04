import { withOrgAuth } from '@/lib/api/withOrgAuth';
import { fail, ok } from '@/lib/api/response';
import { consumeAiRateLimit, rateLimitHeaders } from '@/lib/api/rateLimit';
import { writeAuditLog } from '@/lib/api/auditLog';
import { logger } from '@/lib/logger';
import { repositoryMode } from '@/lib/repo';
import { answerMultilingual } from '@/lib/multilingual/assistant';
import type { Workspace } from '@/lib/assistant/engine';
import { answerWithGeminiFallback } from '@/lib/assistant/gemini-brain';

export const POST = withOrgAuth(async ({ orgId, userId }, req) => {
  let body: unknown; try { body = await req.json(); } catch { return fail('Request body must be valid JSON', 400); }
  const b = body as Record<string, unknown>;
  if (typeof b.question !== 'string' || !b.question.trim() || b.question.length > 1000) return fail('Enter a question of up to 1000 characters.', 400);
  const question = b.question.trim();

  const limited = await consumeAiRateLimit(userId || req.headers.get('x-finova-device-id') || 'anonymous');
  if (!limited.allowed) {
    logger.warn({ event: 'ai_rate_limit_hit', userId, orgId }, 'AI rate limit exceeded');
    await writeAuditLog({ orgId, actorId: userId, action: 'SECURITY', entityType: 'AI_RATE_LIMIT', entityId: 'ai', reason: 'AI rate limit exceeded', ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined, userAgent: req.headers.get('user-agent') ?? undefined });
    return new Response(JSON.stringify({ success: false, error: 'Too many AI queries. Please wait before asking again.' }), { status: 429, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(limited) } });
  }
  const context = typeof b.context === 'object' && b.context !== null
    ? (() => {
        const value = b.context as Record<string, unknown>;
        return typeof value.intent === 'string' && typeof value.question === 'string' && value.question.length <= 400
          ? { intent: value.intent.slice(0, 40), question: value.question }
          : undefined;
      })()
    : undefined;

  let ws: Workspace = { accounts: [], entries: [], invoices: [], expenses: [] };
  if (repositoryMode() === 'prisma') { const { loadWorkspace } = await import('@/lib/assistant/prisma-workspace'); ws = await loadWorkspace(orgId); }
  else if (isWorkspace(b.workspace)) ws = b.workspace;

  // The existing multilingual deterministic brain is always first.
  const primary = answerMultilingual(question, ws);
  const fallbackAnswer = primary.intent === 'help' || /could not|unable|cannot|not sure|no data|confidently/i.test(primary.answer);
  if (!fallbackAnswer) return ok(primary);

  // Gemini is the secondary brain and is reached only after the deterministic brain cannot answer.
  const gemini = await answerWithGeminiFallback(question, ws, { language: typeof b.language === 'string' ? b.language : primary.language, context });
  return ok(gemini.reply ?? primary);
});

function isWorkspace(value: unknown): value is Workspace {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.accounts) && Array.isArray(v.entries) && Array.isArray(v.invoices) && Array.isArray(v.expenses);
}

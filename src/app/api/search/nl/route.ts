import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withOrgAuth } from '@/lib/api/withOrgAuth';
import { ok, fail, validationError } from '@/lib/api/response';
import { rateLimitAsync } from '@/lib/api/rateLimit';
import { dataSource } from '@/lib/env';
import { loadWorkspace } from '@/lib/assistant/prisma-workspace';
import { seedAccounts, seedEntries, seedExpenses, seedInvoices } from '@/lib/data/seed';
import { isNlqInScope, isWriteIntentQuestion, parseQuestion } from '@/lib/nlq/parser';
import { executeSpec } from '@/lib/nlq/executor';
import { chipsForSpec } from '@/lib/nlq/describe';
import { isFollowUp, mergeFollowUp } from '@/lib/nlq/context';
import { relaxationSuggestions } from '@/lib/nlq/relax';
import { querySpecSchema, type NlqResponse, type QuerySpec } from '@/lib/nlq/types';
import { logger } from '@/lib/logger';

const bodySchema = z.object({ question: z.string().trim().min(1).max(400), context: querySpecSchema.optional() }).strict();
const demoWorkspace = { accounts: seedAccounts, entries: seedEntries, invoices: seedInvoices, expenses: seedExpenses };
export const POST = withOrgAuth(async (ctx, req: NextRequest) => {
  if (!(await rateLimitAsync({ key: `nlq:${ctx.userId}`, windowMs: 60_000, max: process.env.NL_SEARCH_LLM === 'true' ? 10 : 30 }))) return fail('Too many search requests. Please try again in a moment.', 429);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null)); if (!parsed.success) return validationError(parsed.error);
  const now = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const text = parsed.data.question;
  if (isWriteIntentQuestion(text)) return ok({ message: 'Search is read-only. Open the relevant Finova module to make that change.', groups: [], chips: [], unresolved: [], alternatives: [] });
  if (!isNlqInScope(text)) return ok({ message: 'I can help find Finova records such as expenses, invoices, payments, journal entries, and accounts.', groups: [], chips: [], unresolved: [], alternatives: [] });
  const workspace = dataSource() === 'prisma' ? await loadWorkspace(ctx.orgId) : demoWorkspace;
  const started = Date.now();
  let spec: QuerySpec | undefined;
  let alternatives: string[] = [];
  if (parsed.data.context && isFollowUp(text, now)) {
    spec = querySpecSchema.parse({ ...mergeFollowUp(parsed.data.context, text, now), confidence: Math.max(parsed.data.context.confidence, 0.75), source: 'rules' });
  } else {
    const result = parseQuestion(text, workspace, now);
    if (result.refusal) return ok({ message: result.refusal, groups: [], chips: [], unresolved: [], alternatives: [] });
    spec = result.spec; alternatives = result.alternatives;
  }
  if (!spec) return fail('I could not understand that search.', 422);
  const groups = executeSpec(workspace, spec, now);
  const response: NlqResponse = { spec, chips: chipsForSpec(spec), groups, unresolved: spec.unresolved, alternatives, message: spec.interpretation, zeroSuggestions: groups.every((group) => group.count === 0) ? relaxationSuggestions(workspace, spec, now) : undefined };
  logger.info({ orgId: ctx.orgId, questionLength: text.length, source: spec.source, confidence: spec.confidence, resultCounts: groups.map((group) => ({ entity: group.entity, count: group.count })), tookMs: Date.now() - started }, 'nlq search');
  return ok(response);
});

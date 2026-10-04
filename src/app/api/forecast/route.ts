import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withOrgAuth } from '@/lib/api/withOrgAuth';
import { rateLimitAsync } from '@/lib/api/rateLimit';
import { ok, fail, validationError } from '@/lib/api/response';
import { loadWorkspace } from '@/lib/assistant/prisma-workspace';
import { seedAccounts, seedEntries, seedExpenses, seedInvoices } from '@/lib/data/seed';
import { buildForecast, forecastToJSON, type ForecastScenario, type ForecastHorizon } from '@/lib/forecast/engine';

const schema = z.object({
  horizon: z.coerce.number().refine(x => [30,60,90,180,365].includes(x)).default(30),
  scenario: z.enum(['best','expected','worst']).default('expected'),
  safetyBuffer: z.coerce.number().min(0).default(0),
});

export const GET = withOrgAuth(async (ctx, req: NextRequest) => {
  if (!(await rateLimitAsync({ key: `forecast:${ctx.orgId}:${ctx.userId}`, windowMs: 60_000, max: 30 }))) {
    return fail('Too many requests', 429);
  }
  const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return validationError(parsed.error);
  const now = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const workspace = process.env.DATA_SOURCE === 'mock' || !process.env.DATABASE_URL
    ? { accounts: seedAccounts, entries: seedEntries, invoices: seedInvoices, expenses: seedExpenses }
    : await loadWorkspace(ctx.orgId);
  const recurringOverrides: Record<string, 'accepted'|'rejected'> = {};
  for (const [key,value] of req.nextUrl.searchParams.entries()) if (key.startsWith('recurring_') && (value === 'accepted' || value === 'rejected')) recurringOverrides[key.slice('recurring_'.length)] = value;
  const forecast = buildForecast({
    ...workspace,
    now,
    horizon: parsed.data.horizon as ForecastHorizon,
    scenario: parsed.data.scenario as ForecastScenario,
    safetyBufferPaise: BigInt(Math.round(parsed.data.safetyBuffer * 100)),
    recurringOverrides,
  });
  return ok({ forecast: forecastToJSON(forecast), premium: process.env.FINOVA_PREMIUM === 'true', generatedAt: new Date().toISOString(), source: process.env.DATA_SOURCE === 'mock' || !process.env.DATABASE_URL ? 'demo' : 'database' });
});

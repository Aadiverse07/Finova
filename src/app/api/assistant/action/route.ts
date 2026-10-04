import { z } from 'zod';
import { withOrgAuth } from '@/lib/api/withOrgAuth';
import { fail, ok } from '@/lib/api/response';
import { writeAuditLog } from '@/lib/api/auditLog';

const schema = z.object({
  action: z.string().min(1).max(80),
  transcript: z.string().max(1000).default(''),
  confirmed: z.boolean(),
  entityId: z.string().max(120).optional(),
});

export const POST = withOrgAuth(async ({ orgId, userId }, req) => {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid assistant action log.', 400);
  const value = parsed.data;
  await writeAuditLog({
    orgId,
    actorId: userId,
    action: 'SECURITY',
    entityType: `VOICE_${value.action.toUpperCase()}`,
    entityId: value.entityId ?? 'voice',
    reason: value.transcript ? `Voice transcript: ${value.transcript.slice(0, 1000)}` : `Voice action confirmed: ${value.confirmed}`,
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });
  return ok({ logged: true });
});

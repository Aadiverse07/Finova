import { withOrgAuth } from '@/lib/api/withOrgAuth';
import { created, fail, ok, validationError } from '@/lib/api/response';
import { buildPaginationResponse, paginationToSkipTake, parsePaginationParams } from '@/lib/api/pagination';
import { writeAuditLog } from '@/lib/api/auditLog';
import { rateLimitAsync } from '@/lib/api/rateLimit';
import { accountCreateSchema, accountListQuerySchema } from '@/lib/schemas/account';
import { DuplicateAccountCodeError, getAccountRepository } from '@/lib/repo';

// Chart of accounts. Every repository call is scoped by the caller's active orgId.

export const GET = withOrgAuth(async ({ orgId }, req) => {
  const { searchParams } = req.nextUrl;
  const query = accountListQuerySchema.safeParse({
    type: searchParams.get('type') ?? undefined,
    isActive: searchParams.get('isActive') ?? undefined,
  });
  if (!query.success) return validationError(query.error);

  const params = parsePaginationParams(searchParams);
  const repo = await getAccountRepository();
  const { items, total } = await repo.list(orgId, query.data, paginationToSkipTake(params));
  return ok(buildPaginationResponse(items, total, params));
});

export const POST = withOrgAuth(async ({ orgId, userId, orgRole }, req) => {
  const allowed = await rateLimitAsync({ key: `create-account:${orgId}:${userId}`, windowMs: 60_000, max: 30 });
  if (!allowed) return fail('Too many requests', 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Request body must be valid JSON', 400);
  }
  const parsed = accountCreateSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const repo = await getAccountRepository();
    const account = await repo.create(orgId, userId, parsed.data);
    await writeAuditLog({
      orgId,
      actorId: userId,
      actorRole: orgRole,
      action: 'CREATE',
      entityType: 'Account',
      entityId: account.id,
      changes: Object.keys(parsed.data),
      reason: 'Account created via /api/accounts',
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });
    return created(account);
  } catch (error: unknown) {
    if (error instanceof DuplicateAccountCodeError) return fail('An account with this code already exists', 409);
    throw error; // withOrgAuth logs it and returns a generic 500
  }
});


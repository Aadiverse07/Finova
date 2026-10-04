import { withOrgAuth } from '@/lib/api/withOrgAuth';
import { fail, ok, validationError } from '@/lib/api/response';
import { buildPaginationResponse, parsePaginationParams } from '@/lib/api/pagination';
import { journalEntrySchema } from '@/lib/schemas/journal';

// Journal persistence (posting workflow, hash chain, per-org entryNo counter) is not implemented yet.
// The contract is in place: auth, org scoping, Zod validation, envelope. Never return unscoped data.

export const GET = withOrgAuth(async (_ctx, req) => {
  const params = parsePaginationParams(req.nextUrl.searchParams);
  return ok(buildPaginationResponse([], 0, params));
});

export const POST = withOrgAuth(async (_ctx, req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Request body must be valid JSON', 400);
  }
  const parsed = journalEntrySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  return fail('Journal persistence is not implemented yet', 501);
});

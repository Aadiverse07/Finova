import { NextRequest } from 'next/server';
import { withOrgAuth } from '@/lib/api/withOrgAuth';
import { ok, validationError } from '@/lib/api/response';
import { extractionSchema } from '@/lib/receipt/types';
import { validateExtraction } from '@/lib/receipt/validation';
export const POST = withOrgAuth(async (_ctx, req: NextRequest) => { const body=await req.json().catch(()=>null); const parsed=extractionSchema.safeParse(body?.extraction); if(!parsed.success) return validationError(parsed.error); return ok({ extraction:validateExtraction(parsed.data), reviewedAt:new Date().toISOString() }); });

import { NextResponse, type NextRequest } from 'next/server';
import { getQuikITIdentity } from '@/lib/quikit-auth';

export async function GET(request: NextRequest) {
  const auth = await getQuikITIdentity(request);
  if (!auth.ok) return NextResponse.json({ error: { code: auth.code, message: auth.message } }, { status: auth.status });
  return NextResponse.json({ data: [], nextCursor: null, orgId: auth.identity.orgId });
}

export async function POST(request: NextRequest) {
  const auth = await getQuikITIdentity(request);
  if (!auth.ok) return NextResponse.json({ error: { code: auth.code, message: auth.message } }, { status: auth.status });
  return NextResponse.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Journal persistence is not implemented yet.' } }, { status: 501 });
}

import { NextRequest, NextResponse } from 'next/server';
import { getQuikITIdentity } from '@/lib/quikit-auth';

export async function GET(req: NextRequest) {
  const auth = await getQuikITIdentity(req);
  if (!auth.ok) return NextResponse.json({ success: true, data: { user: null, provider: 'none' } });
  return NextResponse.json({
    success: true,
    data: {
      user: {
        id: auth.identity.userId,
        name: auth.identity.email?.split('@')[0] ?? auth.identity.userId,
        email: auth.identity.email ?? '',
        role: auth.identity.isSuperAdmin ? 'Super administrator' : (auth.identity.orgRole ?? 'Member'),
      },
      provider: 'quikit',
    },
  });
}

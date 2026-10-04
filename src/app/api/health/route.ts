import { NextResponse } from 'next/server';
import pkg from '../../../../package.json';
import { repositoryMode } from '@/lib/repo';

// Required by the platform (handbook §6.12): GET /api/health -> { ok, version, db }.
// Intentionally unauthenticated and NOT wrapped in the { success, data } envelope - the launcher's
// health-check cron reads this exact shape.
export const dynamic = 'force-dynamic';

export async function GET() {
  let db: 'up' | 'down' = 'up'; // mock mode has no database dependency
  if (repositoryMode() === 'prisma') {
    try {
      const { db: client } = await import('@/lib/db');
      await client.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
  }
  return NextResponse.json({ ok: true, version: pkg.version, db });
}

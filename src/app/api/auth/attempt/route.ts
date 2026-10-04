import { NextResponse } from 'next/server';
import { rateLimitAsync } from '@/lib/api/rateLimit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 }); }
  const data = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {};
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (!email || email.length > 254) return NextResponse.json({ success: false, error: 'Enter a valid email address.' }, { status: 400 });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const result = await rateLimitAsync({ key: `auth:${ip}:${email}`, windowMs: 60_000, max: 5 });
  if (!result) return NextResponse.json({ success: false, error: 'Too many authentication attempts. Please wait a minute and try again.' }, { status: 429, headers: { 'Retry-After': '60' } });
  return NextResponse.json({ success: true, data: { allowed: true } });
}

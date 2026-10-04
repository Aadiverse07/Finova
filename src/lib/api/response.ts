import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

/**
 * Standard QuikIT API envelope (docs/03-api-patterns.md, handbook §7):
 *   success -> { success: true, data }
 *   error   -> { success: false, error: "<string>" }
 * Never return raw arrays or invent new shapes.
 */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

/** POSTs that create a resource return 201. */
export function created<T>(data: T): NextResponse {
  return ok(data, 201);
}

export function fail(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

/** Consistent 400 for Zod failures. */
export function validationError(error: ZodError): NextResponse {
  const message = error.issues
    .map((issue) => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
    .join(', ');
  return fail(message || 'Invalid request', 400);
}

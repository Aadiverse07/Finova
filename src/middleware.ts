import { NextResponse, type NextRequest } from 'next/server';

/**
 * TEMPORARY SHIM for `createMiddleware` from `@quikit/auth/middleware` (handbook §8), which is not
 * available in this standalone package. The platform rule is "no bespoke middleware": replace this
 * file with the shared factory at integration:
 *
 *   export const middleware = createMiddleware({
 *     loginRoute: '/login',
 *     publicRoutes: ['/login', '/select-org', '/invitations'],
 *     centralLoginUrl: process.env.NEXT_PUBLIC_AUTH_URL ? `${process.env.NEXT_PUBLIC_AUTH_URL}/login` : undefined,
 *     centralSelectOrgUrl: process.env.QUIKIT_URL ? `${process.env.QUIKIT_URL}/apps` : undefined,
 *   });
 *
 * This shim only does the cheap edge check: no NextAuth session cookie -> central login. It does NOT
 * validate the token, org membership, or Redis session liveness; API routes validate every request
 * through `GET /api/verify-token` (see src/lib/quikit-auth.ts).
 */
const PUBLIC_ROUTES = ['/login', '/select-org', '/invitations', '/auth-handoff'];
const SESSION_COOKIES = ['next-auth.session-token', '__Secure-next-auth.session-token'];

function hasSessionCookie(request: NextRequest): boolean {
  // NextAuth chunks large tokens as `<name>.0`, `<name>.1`, ...
  return request.cookies
    .getAll()
    .some(({ name }) => SESSION_COOKIES.some((base) => name === base || name.startsWith(`${base}.`)));
}

export function middleware(request: NextRequest) {
  if (process.env.QUIKIT_AUTH_ENABLED !== 'true') return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return NextResponse.next();
  }
  if (hasSessionCookie(request)) return NextResponse.next();

  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL;
  if (!authUrl) return NextResponse.next(); // misconfigured: let /login explain instead of looping

  // Build callbacks from the app's PUBLIC origin, never the pod bind address (INFRA_login_redirect doc).
  const origin = (process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? request.nextUrl.origin).replace(/\/$/, '');
  const login = new URL(`${authUrl.replace(/\/$/, '')}/login`);
  login.searchParams.set('callbackUrl', `${origin}${pathname}${search}`);
  return NextResponse.redirect(login);
}

// API routes authenticate themselves (401 JSON, never an HTML redirect).
export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico).*)'],
};

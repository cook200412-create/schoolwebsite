import { NextResponse, type NextRequest } from 'next/server';

/** Cheap edge gate: no session cookie → /login. Real authorization is enforced by the API on every request. */
export function middleware(req: NextRequest) {
  // csrf_token lives 7 days on path / (the refresh cookie is path-scoped to /api/auth), so it doubles as the session marker
  const has = req.cookies.has('access_token') || req.cookies.has('csrf_token');
  if (!has) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/portal/:path*'] };

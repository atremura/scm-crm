import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow these paths to pass through without checks
  const publicPaths = ['/login', '/register', '/api/auth', '/api/register'];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  // Skip middleware for public paths
  if (isPublicPath) {
    return NextResponse.next();
  }

  // Check authentication for protected routes
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    salt: 'authjs.session-token',
  });

  // If not authenticated and trying to access protected route, redirect to login
  if (!token && pathname !== '/') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Root path handling
  if (pathname === '/') {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    } else {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api(?!/auth)|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
};
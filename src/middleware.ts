import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/login', '/api', '/_next', '/favicon.ico', '/logo.jpg', '/manifest.json', '/sw.js'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('sb-token')?.value;

  // 1. Always allow public paths (static assets, login page)
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 2. Root path: redirect based on auth status
  if (pathname === '/') {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    try {
      const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      const role = (payload as any).app_role;
      if (role === 'superadmin') return NextResponse.redirect(new URL('/superadmin', request.url));
      if (role === 'owner' || role === 'admin') return NextResponse.redirect(new URL('/owner', request.url));
      return NextResponse.redirect(new URL('/kasir', request.url));
    } catch {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // 3. Protected routes: require a valid token
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const role = (payload as any).app_role;

    // Level 0: Superadmin only
    if (pathname.startsWith('/superadmin') && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Level 1: Owner and above
    if (pathname.startsWith('/owner') && role !== 'owner' && role !== 'admin' && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Level 2: Kasir and above
    if (pathname.startsWith('/kasir') && role !== 'kasir' && role !== 'owner' && role !== 'admin' && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
  } catch {
    // Token expired or invalid — boot to login
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.jpg|manifest.json|sw.js).*)'],
};

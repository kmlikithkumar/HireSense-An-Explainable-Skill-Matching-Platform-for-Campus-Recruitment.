import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE } from '@/lib/auth';

// Page-level gate. API routes do their own role checks as well (defence in depth).
export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(COOKIE)?.value);
  const { pathname } = req.nextUrl;
  const need = pathname.startsWith('/admin') ? 'admin' : 'student';
  if (!session) return NextResponse.redirect(new URL('/login', req.url));
  if (session.role !== need) return NextResponse.redirect(new URL(session.role === 'admin' ? '/admin' : '/student', req.url));
  return NextResponse.next();
}

export const config = { matcher: ['/student/:path*', '/admin/:path*'] };

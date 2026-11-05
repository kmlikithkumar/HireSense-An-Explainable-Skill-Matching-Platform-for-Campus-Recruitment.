import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export const COOKIE = 'hs_session';
const MAX_AGE_S = 60 * 60 * 8;

export type Session = { uid: number; role: 'student' | 'admin'; sid: number | null };

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET must be set to at least 32 characters.');
  return new TextEncoder().encode(s);
}

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ role: s.role, sid: s.sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(s.uid))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    const role = payload.role;
    if (role !== 'student' && role !== 'admin') return null;
    return { uid: Number(payload.sub), role, sid: (payload.sid as number | null) ?? null };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifySession(jar.get(COOKIE)?.value);
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: MAX_AGE_S,
};

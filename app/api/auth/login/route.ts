import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { query } from '@/lib/db';
import { signSession, COOKIE, cookieOptions } from '@/lib/auth';
import { dbError, fail, json, parseBody, isResponse } from '@/lib/api';

const schema = z.object({ email: z.string().email(), password: z.string().min(1).max(100) });
// Compared when the email is unknown, so response time does not reveal which emails exist.
const DUMMY = bcrypt.hashSync('not-a-real-password', 10);

export async function POST(req: Request) {
  const b = await parseBody(req, schema);
  if (isResponse(b)) return b;
  try {
    const r = await query(
      `SELECT u.user_id, u.password_hash, u.role, s.student_id
       FROM users u LEFT JOIN students s ON s.user_id = u.user_id
       WHERE u.email = lower($1)`, [b.email]);
    const u = r.rows[0];
    const ok = await bcrypt.compare(b.password, u?.password_hash ?? DUMMY);
    if (!u || !ok) return fail('Invalid email or password', 401);
    (await cookies()).set(COOKIE, await signSession({ uid: u.user_id, role: u.role, sid: u.student_id ?? null }), cookieOptions);
    return json({ ok: true, role: u.role });
  } catch (e) {
    return dbError(e);
  }
}

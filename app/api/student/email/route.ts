import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { dbError, json, parseBody, requireRole, isResponse, fail } from '@/lib/api';

const schema = z.object({
  newEmail: z.string().email('Enter a valid email').max(255),
  password: z.string().min(1, 'Enter your password').max(100),
}).strict();

// Changing the login email requires the current password. Uniqueness is enforced by the database.
export async function POST(req: Request) {
  const s = await requireRole('student');
  if (isResponse(s)) return s;
  const b = await parseBody(req, schema);
  if (isResponse(b)) return b;
  try {
    const r = await query('SELECT password_hash FROM users WHERE user_id = $1', [s.uid]);
    if (!r.rows[0]) return fail('Account not found', 404);
    if (!(await bcrypt.compare(b.password, r.rows[0].password_hash))) {
      return NextResponse.json({ error: 'Password is incorrect', fields: { password: 'Incorrect password' } }, { status: 403 });
    }
    await query('UPDATE users SET email = lower($1) WHERE user_id = $2', [b.newEmail, s.uid]);
    return json({ ok: true, email: b.newEmail.toLowerCase() });
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'That email is already registered', fields: { newEmail: 'Already registered' } }, { status: 409 });
    }
    return dbError(e);
  }
}

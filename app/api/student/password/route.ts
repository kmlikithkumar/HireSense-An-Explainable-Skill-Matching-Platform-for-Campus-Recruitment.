import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '@/lib/db';
import { dbError, fail, json, parseBody, requireRole, isResponse } from '@/lib/api';
import { NextResponse } from 'next/server';

const schema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(100),
  newPassword: z.string().min(8, 'At least 8 characters').max(100)
    .regex(/[A-Za-z]/, 'Needs a letter').regex(/[0-9]/, 'Needs a digit'),
}).strict();

export async function POST(req: Request) {
  const s = await requireRole('student');
  if (isResponse(s)) return s;
  const b = await parseBody(req, schema);
  if (isResponse(b)) return b;
  try {
    const r = await query('SELECT password_hash FROM users WHERE user_id = $1', [s.uid]);
    if (!r.rows[0]) return fail('Account not found', 404);
    if (!(await bcrypt.compare(b.currentPassword, r.rows[0].password_hash))) {
      return NextResponse.json({ error: 'Current password is incorrect', fields: { currentPassword: 'Incorrect password' } }, { status: 403 });
    }
    if (b.currentPassword === b.newPassword) {
      return NextResponse.json({ error: 'New password must differ from the current one', fields: { newPassword: 'Choose a different password' } }, { status: 422 });
    }
    await query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [await bcrypt.hash(b.newPassword, 10), s.uid]);
    return json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}

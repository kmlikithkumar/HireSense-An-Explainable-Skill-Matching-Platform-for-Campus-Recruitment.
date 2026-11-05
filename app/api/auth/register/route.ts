import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { withTransaction, toVectorLiteral } from '@/lib/db';
import { signSession, COOKIE, cookieOptions } from '@/lib/auth';
import { dbError, json, parseBody, isResponse, fail } from '@/lib/api';
import { embedText } from '@/lib/embeddings';

const schema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100).regex(/[A-Za-z]/, 'needs a letter').regex(/[0-9]/, 'needs a digit'),
  fullName: z.string().trim().min(1).max(100),
  srn: z.string().regex(/^PES[0-9][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}$/, 'SRN looks like PES1UG24CS101'),
  deptId: z.number().int().positive(),
  cgpa: z.number().min(0).max(10),
  backlogCount: z.number().int().min(0).max(50),
  gradYear: z.number().int().min(2024).max(2035),
  resumeText: z.string().max(8000).optional(),
});

// Public sign-up creates STUDENT accounts only. Admin accounts are created in the database.
export async function POST(req: Request) {
  const b = await parseBody(req, schema);
  if (isResponse(b)) return b;
  try {
    const hash = await bcrypt.hash(b.password, 10);
    const emb = b.resumeText && b.resumeText.trim().length >= 30 ? await embedText(b.resumeText) : null;
    const out = await withTransaction(async (c) => {
      const u = await c.query(
        `INSERT INTO users (email, password_hash, role) VALUES (lower($1), $2, 'student') RETURNING user_id`,
        [b.email, hash]);
      const s = await c.query(
        `INSERT INTO students (user_id, srn, full_name, dept_id, cgpa, backlog_count, grad_year, resume_text,
                               resume_embedding, embedding_model)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::vector,$10) RETURNING student_id`,
        [u.rows[0].user_id, b.srn, b.fullName, b.deptId, b.cgpa, b.backlogCount, b.gradYear,
         b.resumeText ?? null, emb ? toVectorLiteral(emb.vector) : null, emb?.model ?? null]);
      return { uid: u.rows[0].user_id as number, sid: s.rows[0].student_id as number };
    });
    (await cookies()).set(COOKIE, await signSession({ uid: out.uid, role: 'student', sid: out.sid }), cookieOptions);
    return json({ ok: true, role: 'student' }, 201);
  } catch (e) {
    if ((e as { code?: string }).code === '23505') return fail('Email or SRN is already registered', 409);
    return dbError(e);
  }
}

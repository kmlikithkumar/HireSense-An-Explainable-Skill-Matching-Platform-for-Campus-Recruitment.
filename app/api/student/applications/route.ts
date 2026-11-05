import { z } from 'zod';
import { query, withTransaction } from '@/lib/db';
import { dbError, json, parseBody, requireRole, isResponse } from '@/lib/api';

export async function GET() {
  const s = await requireRole('student');
  if (isResponse(s)) return s;
  const r = await query('SELECT * FROM v_student_applications WHERE student_id = $1 ORDER BY applied_at DESC', [s.sid]);
  return json(r.rows);
}

// The eligibility check happens in the database trigger, not here.
export async function POST(req: Request) {
  const s = await requireRole('student');
  if (isResponse(s)) return s;
  const b = await parseBody(req, z.object({ jobId: z.number().int().positive() }));
  if (isResponse(b)) return b;
  try {
    const out = await withTransaction(async (c) => {
      await c.query(`SELECT set_config('hiresense.actor', $1, true)`, [String(s.uid)]);
      const r = await c.query(
        'INSERT INTO applications (student_id, job_id) VALUES ($1, $2) RETURNING application_id, match_score',
        [s.sid, b.jobId]);
      return r.rows[0];
    });
    return json(out, 201);
  } catch (e) {
    return dbError(e);
  }

}

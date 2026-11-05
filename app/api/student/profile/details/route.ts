import { z } from 'zod';
import { withTransaction } from '@/lib/db';
import { dbError, fail, json, parseBody, requireRole, isResponse } from '@/lib/api';

const twoDecimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

// .strict() rejects any other key (srn, role, userId, studentId, embeddings ...) with a 422.
const schema = z
  .object({
    fullName: z.string().trim().min(1, 'Name is required').max(100).optional(),
    deptId: z.number().int().positive().optional(),
    cgpa: z.number().min(0, 'CGPA must be between 0 and 10').max(10, 'CGPA must be between 0 and 10')
      .refine(twoDecimals, 'Use at most 2 decimal places').optional(),
    backlogCount: z.number().int('Whole number only').min(0, 'Cannot be negative').max(50).optional(),
    gradYear: z.number().int().min(2024, 'Between 2024 and 2035').max(2035, 'Between 2024 and 2035').optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

const ELIGIBLE_OPEN = `SELECT count(*)::int AS n FROM job_postings j
                       CROSS JOIN LATERAL check_eligibility($1, j.job_id) e
                       WHERE j.status = 'open' AND e.is_eligible`;

// Updates the signed-in student's own details. The student id always comes from the session.
// Existing applications are never touched. Eligibility rules stay in the database.
export async function PATCH(req: Request) {
  const s = await requireRole('student');
  if (isResponse(s)) return s;
  const b = await parseBody(req, schema);
  if (isResponse(b)) return b;
  try {
    const out = await withTransaction(async (c) => {
      await c.query(`SELECT set_config('hiresense.actor', $1, true)`, [String(s.uid)]);
      const before = (await c.query(ELIGIBLE_OPEN, [s.sid])).rows[0].n as number;
      const r = await c.query(
        `UPDATE students SET
            full_name     = COALESCE($1, full_name),
            dept_id       = COALESCE($2, dept_id),
            cgpa          = COALESCE($3, cgpa),
            backlog_count = COALESCE($4, backlog_count),
            grad_year     = COALESCE($5, grad_year)
         WHERE student_id = $6
         RETURNING full_name, dept_id, cgpa, backlog_count, grad_year`,
        [b.fullName ?? null, b.deptId ?? null, b.cgpa ?? null, b.backlogCount ?? null, b.gradYear ?? null, s.sid]);
      if (!r.rowCount) return null;
      const after = (await c.query(ELIGIBLE_OPEN, [s.sid])).rows[0].n as number;
      return { profile: r.rows[0], eligibleOpenPostings: { before, after } };
    });
    return out ? json(out) : fail('Student not found', 404);
  } catch (e) {
    return dbError(e);
  }
}

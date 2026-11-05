import { query } from '@/lib/db';
import { dbError, fail, json, requireRole, isResponse } from '@/lib/api';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole('admin');
  if (isResponse(s)) return s;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return fail('Invalid id', 422);
  try {
    const r = await query(
      `SELECT a.application_id, a.status, a.match_score, a.applied_at,
              st.full_name, st.srn, st.cgpa, d.code AS dept_code,
              COALESCE((SELECT json_agg(x ORDER BY x.changed_at DESC)
                 FROM (SELECT field, old_value, new_value, changed_at
                       FROM student_profile_audit WHERE student_id = st.student_id
                       ORDER BY changed_at DESC, audit_id DESC LIMIT 3) x), '[]') AS profile_changes,
              COALESCE((SELECT json_agg(json_build_object('round_id', r.round_id, 'round_no', r.round_no,
                         'round_type', r.round_type, 'scheduled_at', r.scheduled_at, 'result', r.result)
                         ORDER BY r.round_no)
                        FROM interview_rounds r WHERE r.application_id = a.application_id), '[]') AS rounds
       FROM applications a
       JOIN students st ON st.student_id = a.student_id
       JOIN departments d ON d.dept_id = st.dept_id
       WHERE a.job_id = $1
       ORDER BY a.match_score DESC NULLS LAST`, [id]);
    return json(r.rows);
  } catch (e) {
    return dbError(e);
  }
}

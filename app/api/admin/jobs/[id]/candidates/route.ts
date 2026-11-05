import { query } from '@/lib/db';
import { dbError, fail, json, requireRole, isResponse } from '@/lib/api';

// Students ranked by cosine similarity to the posting. ?all=1 includes ineligible students.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole('admin');
  if (isResponse(s)) return s;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return fail('Invalid id', 422);
  const all = new URL(req.url).searchParams.get('all') === '1';
  try {
    const head = await query(
      `SELECT j.job_id, j.title, c.name AS company_name, j.status, j.min_cgpa, j.max_backlogs, j.deadline,
              ARRAY(SELECT k.name FROM job_skills js JOIN skills k USING (skill_id) WHERE js.job_id = j.job_id ORDER BY k.name) AS skills
       FROM job_postings j JOIN companies c ON c.company_id = j.company_id WHERE j.job_id = $1`, [id]);
    if (!head.rows[0]) return fail('Posting not found', 404);
    const r = await query(
      `SELECT m.*, a.application_id, a.status AS application_status,
              COALESCE((SELECT json_agg(x ORDER BY x.changed_at DESC)
                 FROM (SELECT field, old_value, new_value, changed_at
                       FROM student_profile_audit WHERE student_id = m.student_id
                       ORDER BY changed_at DESC, audit_id DESC LIMIT 3) x), '[]') AS profile_changes
       FROM match_students_for_job($1, 50, $2) m
       LEFT JOIN applications a ON a.student_id = m.student_id AND a.job_id = $1
       ORDER BY m.similarity DESC`, [id, !all]);
    return json({ job: head.rows[0], candidates: r.rows });
  } catch (e) {
    return dbError(e);
  }
}

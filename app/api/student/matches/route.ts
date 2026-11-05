import { query } from '@/lib/db';
import { dbError, json, requireRole, isResponse } from '@/lib/api';

export async function GET() {
  const s = await requireRole('student');
  if (isResponse(s)) return s;
  try {
    const r = await query(
      `SELECT m.job_id, m.title, m.company_name, m.similarity, m.is_eligible, m.reason,
              m.matched_skills, m.missing_skills, j.ctc_lpa, j.deadline,
              a.status AS application_status
       FROM match_jobs_for_student($1, 20) m
       JOIN job_postings j ON j.job_id = m.job_id
       LEFT JOIN applications a ON a.job_id = m.job_id AND a.student_id = $1
       ORDER BY m.similarity DESC`, [s.sid]);
    return json(r.rows);
  } catch (e) {
    return dbError(e);
  }
}

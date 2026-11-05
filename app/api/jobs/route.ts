import { query } from '@/lib/db';
import { dbError, json, fail } from '@/lib/api';
import { getSession } from '@/lib/auth';

// Open postings. ?q= uses PostgreSQL full-text search; students also get an eligibility verdict.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return fail('Not signed in', 401);
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  const sid = session.role === 'student' ? session.sid : null;
  try {
    const r = await query(
      `SELECT j.job_id, j.title, c.name AS company_name, j.ctc_lpa, j.min_cgpa, j.max_backlogs, j.deadline,
              left(j.jd_text, 220) AS summary,
              ARRAY(SELECT d.code FROM job_eligible_departments e JOIN departments d USING (dept_id)
                    WHERE e.job_id = j.job_id ORDER BY d.code) AS departments,
              el.is_eligible, el.reason,
              CASE WHEN $1 <> '' THEN ts_rank(j.search_tsv, websearch_to_tsquery('english', $1)) END AS rank
       FROM job_postings j
       JOIN companies c ON c.company_id = j.company_id
       LEFT JOIN LATERAL check_eligibility($2::int, j.job_id) el ON $2::int IS NOT NULL
       WHERE j.status = 'open'
         AND ($1 = '' OR j.search_tsv @@ websearch_to_tsquery('english', $1))
       ORDER BY rank DESC NULLS LAST, j.deadline`, [q, sid]);
    return json(r.rows);
  } catch (e) {
    return dbError(e);
  }
}

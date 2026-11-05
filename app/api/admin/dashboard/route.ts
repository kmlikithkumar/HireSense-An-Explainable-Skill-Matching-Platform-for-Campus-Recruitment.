import { query } from '@/lib/db';
import { dbError, json, requireRole, isResponse } from '@/lib/api';

export async function GET() {
  const s = await requireRole('admin');
  if (isResponse(s)) return s;
  try {
    const [totals, byStatus, companies, skillGap] = await Promise.all([
      query(`SELECT (SELECT count(*) FROM students)::int AS students,
                    (SELECT count(*) FROM job_postings WHERE status = 'open')::int AS open_jobs,
                    (SELECT count(*) FROM applications)::int AS applications,
                    (SELECT round(avg(match_score), 3) FROM applications) AS avg_match_score`),
      query(`SELECT status, count(*)::int AS n FROM applications GROUP BY status ORDER BY n DESC`),
      query(`SELECT * FROM v_company_placement_summary ORDER BY applications DESC, company_name`),
      // Skills employers ask for that few students have (GROUP BY + HAVING + subquery)
      query(`SELECT k.name,
                    count(DISTINCT js.job_id)::int AS postings_requiring,
                    (SELECT count(*) FROM student_skills ss WHERE ss.skill_id = k.skill_id)::int AS students_with
             FROM skills k JOIN job_skills js ON js.skill_id = k.skill_id
             JOIN job_postings j ON j.job_id = js.job_id AND j.status = 'open'
             GROUP BY k.skill_id, k.name
             HAVING count(DISTINCT js.job_id) >= 1
             ORDER BY (SELECT count(*) FROM student_skills ss WHERE ss.skill_id = k.skill_id) - count(DISTINCT js.job_id),
                      k.name
             LIMIT 8`),
    ]);
    return json({ totals: totals.rows[0], byStatus: byStatus.rows, companies: companies.rows, skillGap: skillGap.rows });
  } catch (e) {
    return dbError(e);
  }
}

import { z } from 'zod';
import { query, withTransaction, toVectorLiteral } from '@/lib/db';
import { dbError, json, parseBody, requireRole, isResponse } from '@/lib/api';
import { embedText } from '@/lib/embeddings';

export async function GET() {
  const s = await requireRole('admin');
  if (isResponse(s)) return s;
  const r = await query(
    `SELECT j.job_id, j.title, c.name AS company_name, j.status, j.deadline, j.min_cgpa, j.max_backlogs, j.ctc_lpa,
            count(a.application_id)::int AS applications
     FROM job_postings j JOIN companies c ON c.company_id = j.company_id
     LEFT JOIN applications a ON a.job_id = j.job_id
     GROUP BY j.job_id, c.name ORDER BY j.status, j.deadline`);
  return json(r.rows);
}

const schema = z.object({
  companyName: z.string().trim().min(1).max(120),
  industry: z.string().trim().max(80).optional(),
  title: z.string().trim().min(3).max(150),
  jdText: z.string().trim().min(40, 'Describe the role in at least 40 characters').max(8000),
  minCgpa: z.number().min(0).max(10),
  maxBacklogs: z.number().int().min(0).max(50),
  ctcLpa: z.number().positive().max(999).optional(),
  deadline: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  deptIds: z.array(z.number().int().positive()).max(20),
  skillIds: z.array(z.number().int().positive()).max(30),
});

export async function POST(req: Request) {
  const s = await requireRole('admin');
  if (isResponse(s)) return s;
  const b = await parseBody(req, schema);
  if (isResponse(b)) return b;
  try {
    const emb = await embedText(`${b.title}. ${b.jdText}`);
    const jobId = await withTransaction(async (c) => {
      const co = await c.query(
        `INSERT INTO companies (name, industry) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET industry = COALESCE(EXCLUDED.industry, companies.industry)
         RETURNING company_id`, [b.companyName, b.industry ?? null]);
      const j = await c.query(
        `INSERT INTO job_postings (company_id, title, jd_text, jd_embedding, embedding_model, min_cgpa, max_backlogs,
                                   ctc_lpa, deadline, created_by)
         VALUES ($1,$2,$3,$4::vector,$5,$6,$7,$8,$9,$10) RETURNING job_id`,
        [co.rows[0].company_id, b.title, b.jdText, toVectorLiteral(emb.vector), emb.model, b.minCgpa,
         b.maxBacklogs, b.ctcLpa ?? null, b.deadline, s.uid]);
      const id = j.rows[0].job_id as number;
      if (b.deptIds.length)
        await c.query('INSERT INTO job_eligible_departments (job_id, dept_id) SELECT $1, unnest($2::int[])', [id, b.deptIds]);
      if (b.skillIds.length)
        await c.query('INSERT INTO job_skills (job_id, skill_id) SELECT $1, unnest($2::int[])', [id, b.skillIds]);
      return id;
    });
    return json({ jobId }, 201);
  } catch (e) {
    return dbError(e);
  }
}

import { z } from 'zod';
import { query, withTransaction, toVectorLiteral } from '@/lib/db';
import { dbError, json, parseBody, requireRole, isResponse } from '@/lib/api';
import { embedText } from '@/lib/embeddings';

export async function GET() {
  const s = await requireRole('student');
  if (isResponse(s)) return s;
  const r = await query(
    `SELECT st.student_id, st.full_name, st.srn, d.code AS dept_code, st.dept_id, u.email,
            st.cgpa, st.backlog_count, st.grad_year,
            st.resume_text, st.resume_embedding IS NOT NULL AS has_embedding, st.embedding_model,
            ARRAY(SELECT k.name FROM student_skills ss JOIN skills k USING (skill_id)
                  WHERE ss.student_id = st.student_id ORDER BY k.name) AS skills,
            COALESCE((SELECT json_agg(x ORDER BY x.changed_at DESC)
                      FROM (SELECT field, old_value, new_value, changed_at
                            FROM student_profile_audit WHERE student_id = st.student_id
                            ORDER BY changed_at DESC, audit_id DESC LIMIT 5) x), '[]') AS recent_changes
     FROM students st
     JOIN departments d ON d.dept_id = st.dept_id
     JOIN users u ON u.user_id = st.user_id
     WHERE st.student_id = $1`, [s.sid]);
  return json(r.rows[0] ?? null);
}

const schema = z.object({ resumeText: z.string().trim().min(30, 'Resume text must be at least 30 characters').max(8000) });

// Saving a resume: the trigger clears the stale vector and refreshes derived skills,
// then we store the new embedding in the same transaction.
export async function PUT(req: Request) {
  const s = await requireRole('student');
  if (isResponse(s)) return s;
  const b = await parseBody(req, schema);
  if (isResponse(b)) return b;
  try {
    const emb = await embedText(b.resumeText);
    await withTransaction(async (c) => {
      await c.query('UPDATE students SET resume_text = $1 WHERE student_id = $2', [b.resumeText, s.sid]);
      await c.query('UPDATE students SET resume_embedding = $1::vector, embedding_model = $2 WHERE student_id = $3',
        [toVectorLiteral(emb.vector), emb.model, s.sid]);
    });
    return json({ ok: true, model: emb.model });
  } catch (e) {
    return dbError(e);
  }
}

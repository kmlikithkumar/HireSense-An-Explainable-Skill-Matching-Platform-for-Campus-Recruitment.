// Fills (or refreshes) embeddings for students and job postings.
import { pool, query, toVectorLiteral } from '../lib/db';
import { embedText, getEmbedder } from '../lib/embeddings';

async function main() {
  const { model } = await getEmbedder();
  console.log(`embedding model: ${model}`);

  const students = await query<{ student_id: number; resume_text: string }>(
    `SELECT student_id, resume_text FROM students
     WHERE resume_text IS NOT NULL AND (resume_embedding IS NULL OR embedding_model IS DISTINCT FROM $1)`,
    [model]
  );
  for (const s of students.rows) {
    const { vector } = await embedText(s.resume_text);
    await query('UPDATE students SET resume_embedding = $1::vector, embedding_model = $2 WHERE student_id = $3',
      [toVectorLiteral(vector), model, s.student_id]);
  }
  console.log(`students embedded: ${students.rowCount}`);

  const jobs = await query<{ job_id: number; title: string; jd_text: string }>(
    `SELECT job_id, title, jd_text FROM job_postings
     WHERE jd_embedding IS NULL OR embedding_model IS DISTINCT FROM $1`,
    [model]
  );
  for (const j of jobs.rows) {
    const { vector } = await embedText(`${j.title}. ${j.jd_text}`);
    await query('UPDATE job_postings SET jd_embedding = $1::vector, embedding_model = $2 WHERE job_id = $3',
      [toVectorLiteral(vector), model, j.job_id]);
  }
  console.log(`postings embedded: ${jobs.rowCount}`);
  await pool().end();
}
main().catch((e) => { console.error(e); process.exit(1); });

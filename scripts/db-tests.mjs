// Database test cases. Every test runs inside a transaction that is rolled back,
// so the sample data is left untouched.   Usage: npm run test:db
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let passed = 0, failed = 0;
const results = [];

async function test(name, fn) {
  await client.query('BEGIN');
  try {
    await fn();
    results.push(['PASS', name]); passed++;
  } catch (e) {
    results.push(['FAIL', name, e.message]); failed++;
  } finally {
    await client.query('ROLLBACK');
  }
}
const eq = (a, b, msg) => { if (a !== b) throw new Error(`${msg ?? 'expected'}: got ${a}, want ${b}`); };
const one = async (sql, params) => (await client.query(sql, params)).rows[0];
async function expectError(code, sql, params) {
  await client.query('SAVEPOINT t');
  try {
    await client.query(sql, params);
  } catch (e) {
    await client.query('ROLLBACK TO t');
    eq(e.code, code, `SQLSTATE for: ${e.message}`);
    return e;
  }
  throw new Error(`expected SQLSTATE ${code} but the statement succeeded`);
}
const sid = async (srn) => (await one('SELECT student_id AS v FROM students WHERE srn=$1', [srn])).v;
const jid = async (title) => (await one('SELECT job_id AS v FROM job_postings WHERE title=$1', [title])).v;

// ---------------- eligibility ----------------
await test('eligible student passes check_eligibility', async () => {
  const r = await one('SELECT * FROM check_eligibility($1,$2)', [await sid('PES1UG24CS101'), await jid('Backend Engineer')]);
  eq(r.is_eligible, true);
});
await test('CGPA below minimum is rejected with a reason', async () => {
  await client.query(`UPDATE students SET cgpa = 7.0 WHERE srn='PES1UG24CS101'`);
  const r = await one('SELECT * FROM check_eligibility($1,$2)', [await sid('PES1UG24CS101'), await jid('Backend Engineer')]);
  eq(r.is_eligible, false); eq(/below the minimum/.test(r.reason), true, 'reason text');
});
await test('too many backlogs is rejected', async () => {
  const r = await one('SELECT * FROM check_eligibility($1,$2)', [await sid('PES1UG24AM113'), await jid('Computer Vision Engineer')]);
  eq(r.is_eligible, false);
});
await test('department restriction is enforced', async () => {
  const r = await one('SELECT * FROM check_eligibility($1,$2)', [await sid('PES1UG24AM102'), await jid('Mechanical Design Engineer')]);
  eq(r.is_eligible, false); eq(/Department/.test(r.reason), true);
});
await test('job with no department rows accepts any department', async () => {
  const r = await one('SELECT * FROM check_eligibility($1,$2)', [await sid('PES1UG24ME110'), await jid('Data Analyst')]);
  eq(r.is_eligible, true);
});
await test('closed posting is not eligible', async () => {
  await client.query(`UPDATE job_postings SET status='closed' WHERE title='Backend Engineer'`);
  const r = await one('SELECT * FROM check_eligibility($1,$2)', [await sid('PES1UG24CS101'), await jid('Backend Engineer')]);
  eq(r.is_eligible, false);
});

// ---------------- triggers ----------------
await test('insert trigger blocks an ineligible application (HS001)', async () => {
  await expectError('HS001', 'INSERT INTO applications (student_id, job_id) VALUES ($1,$2)',
    [await sid('PES1UG24AM113'), await jid('Computer Vision Engineer')]);
});
await test('insert trigger stamps match_score and forces status=applied', async () => {
  const s = await sid('PES1UG24CS101'), j = await jid('Cloud and DevOps Engineer');
  const r = await one(`INSERT INTO applications (student_id, job_id, status) VALUES ($1,$2,'selected') RETURNING status, match_score`, [s, j]);
  eq(r.status, 'applied', 'status forced'); eq(r.match_score !== null, true, 'score present');
});
await test('duplicate application is rejected (unique constraint)', async () => {
  await expectError('23505', 'INSERT INTO applications (student_id, job_id) VALUES ($1,$2)',
    [await sid('PES1UG24CS101'), await jid('Backend Engineer')]);
});
await test('illegal status transition is blocked (HS002)', async () => {
  const a = await one(`SELECT application_id AS id FROM applications WHERE status='applied' LIMIT 1`);
  await expectError('HS002', `UPDATE applications SET status='selected' WHERE application_id=$1`, [a.id]);
});
await test('audit trigger records inserts and status changes with the actor', async () => {
  const admin = (await one(`SELECT user_id AS v FROM users WHERE role='admin'`)).v;
  await client.query(`SELECT set_config('hiresense.actor', $1, true)`, [String(admin)]);
  const s = await sid('PES1UG24CS101'), j = await jid('Cloud and DevOps Engineer');
  const a = await one('INSERT INTO applications (student_id, job_id) VALUES ($1,$2) RETURNING application_id AS id', [s, j]);
  await client.query(`UPDATE applications SET status='rejected' WHERE application_id=$1`, [a.id]);
  const rows = (await client.query('SELECT old_status,new_status,changed_by FROM application_audit WHERE application_id=$1 ORDER BY audit_id', [a.id])).rows;
  eq(rows.length, 2, 'audit rows'); eq(rows[0].new_status, 'applied'); eq(rows[1].old_status, 'applied');
  eq(rows[1].new_status, 'rejected'); eq(Number(rows[1].changed_by), admin, 'actor');
});
await test('editing a resume clears its embedding and refreshes derived skills', async () => {
  const s = await sid('PES1UG24CS101');
  await client.query(`UPDATE students SET resume_text='Wrote Verilog and Embedded C for an RTOS' WHERE student_id=$1`, [s]);
  const r = await one('SELECT resume_embedding IS NULL AS cleared FROM students WHERE student_id=$1', [s]);
  eq(r.cleared, true, 'embedding cleared');
  const skills = (await client.query(`SELECT k.name FROM student_skills ss JOIN skills k USING(skill_id) WHERE student_id=$1 ORDER BY 1`, [s])).rows.map(x => x.name);
  eq(skills.join(','), 'Embedded C,RTOS,Verilog');
});
await test('skill matching respects word boundaries (SQL vs PostgreSQL, Java vs JavaScript)', async () => {
  const s = await sid('PES1UG24CS101');
  await client.query(`UPDATE students SET resume_text='Used PostgreSQL and JavaScript' WHERE student_id=$1`, [s]);
  const skills = (await client.query(`SELECT k.name FROM student_skills ss JOIN skills k USING(skill_id) WHERE student_id=$1 ORDER BY 1`, [s])).rows.map(x => x.name);
  eq(skills.join(','), 'JavaScript,PostgreSQL');
});

// ---------------- constraints ----------------
await test('CHECK rejects CGPA above 10', async () => {
  await expectError('23514', `UPDATE students SET cgpa = 10.5 WHERE srn='PES1UG24CS101'`);
});
await test('CHECK rejects a malformed SRN', async () => {
  await expectError('23514', `UPDATE students SET srn = 'abc' WHERE srn='PES1UG24CS101'`);
});
await test('CHECK rejects a malformed email', async () => {
  await expectError('23514', `INSERT INTO users (email, password_hash, role) VALUES ('not-an-email','x','student')`);
});
await test('CHECK rejects an unknown role', async () => {
  await expectError('23514', `INSERT INTO users (email, password_hash, role) VALUES ('x@y.zz','x','superuser')`);
});
await test('foreign key blocks a student with a missing department', async () => {
  await expectError('23503', `UPDATE students SET dept_id = 9999 WHERE srn='PES1UG24CS101'`);
});
await test('interview result requires a scheduled time (ALTER-added constraint)', async () => {
  const a = await one(`SELECT application_id AS id FROM applications LIMIT 1`);
  await expectError('23514', `INSERT INTO interview_rounds (application_id, round_no, round_type, result) VALUES ($1, 9, 'hr', 'pass')`, [a.id]);
});

// ---------------- transaction ----------------
await test('shortlist_candidate updates status and creates round 1 together', async () => {
  const admin = (await one(`SELECT user_id AS v FROM users WHERE role='admin'`)).v;
  const a = await one(`SELECT application_id AS id FROM applications WHERE status='applied' LIMIT 1`);
  await one(`SELECT shortlist_candidate($1,'technical', now() + interval '2 days', $2)`, [a.id, admin]);
  eq((await one('SELECT status FROM applications WHERE application_id=$1', [a.id])).status, 'shortlisted');
  eq(Number((await one('SELECT count(*) AS c FROM interview_rounds WHERE application_id=$1', [a.id])).c), 1, 'rounds');
});
await test('shortlist_candidate on a non-applied application changes nothing', async () => {
  const admin = (await one(`SELECT user_id AS v FROM users WHERE role='admin'`)).v;
  const a = await one(`SELECT application_id AS id FROM applications WHERE status='shortlisted' LIMIT 1`);
  const before = Number((await one('SELECT count(*) AS c FROM interview_rounds WHERE application_id=$1', [a.id])).c);
  await expectError('HS002', `SELECT shortlist_candidate($1,'hr', now(), $2)`, [a.id, admin]);
  eq(Number((await one('SELECT count(*) AS c FROM interview_rounds WHERE application_id=$1', [a.id])).c), before, 'rounds unchanged');
});
await test('a failing step rolls back the whole shortlist (bad round type)', async () => {
  const admin = (await one(`SELECT user_id AS v FROM users WHERE role='admin'`)).v;
  const a = await one(`SELECT application_id AS id FROM applications WHERE status='applied' LIMIT 1`);
  await expectError('23514', `SELECT shortlist_candidate($1,'not-a-round', now(), $2)`, [a.id, admin]);
  eq((await one('SELECT status FROM applications WHERE application_id=$1', [a.id])).status, 'applied', 'status rolled back');
});

// ---------------- vector search + views ----------------
await test('match_students_for_job returns results ordered by similarity, eligible only', async () => {
  const rows = (await client.query('SELECT * FROM match_students_for_job($1, 20, true)', [await jid('Computer Vision Engineer')])).rows;
  eq(rows.length > 0, true, 'has rows');
  for (let i = 1; i < rows.length; i++) eq(Number(rows[i - 1].similarity) >= Number(rows[i].similarity), true, 'sorted desc');
  eq(rows.every(r => r.is_eligible), true, 'all eligible');
});
await test('the student whose resume mentions the posting skills ranks first', async () => {
  const rows = (await client.query('SELECT srn FROM match_students_for_job($1, 3, true)', [await jid('Computer Vision Engineer')])).rows;
  eq(rows[0].srn, 'PES1UG24AM102');
});
await test('match_jobs_for_student reports matched and missing skills', async () => {
  const r = (await client.query('SELECT * FROM match_jobs_for_student($1, 10)', [await sid('PES1UG24AM102')])).rows
    .find(x => x.title === 'Computer Vision Engineer');
  eq(r.matched_skills.includes('PyTorch'), true); eq(r.missing_skills.includes('TensorFlow'), true);
});
await test('view v_job_eligible_students agrees with check_eligibility', async () => {
  const j = await jid('Backend Engineer');
  const viaView = Number((await one('SELECT count(*) AS c FROM v_job_eligible_students WHERE job_id=$1', [j])).c);
  const viaFn = Number((await one('SELECT count(*) AS c FROM students s, check_eligibility(s.student_id,$1) e WHERE e.is_eligible', [j])).c);
  eq(viaView, viaFn, 'counts');
});
await test('full-text search finds postings by words in the description', async () => {
  const rows = (await client.query(`SELECT title FROM job_postings WHERE search_tsv @@ plainto_tsquery('english','kubernetes')`)).rows;
  eq(rows.map(r => r.title).join(','), 'Cloud and DevOps Engineer');
});
await test('HNSW indexes exist on both embedding columns', async () => {
  const n = Number((await one(`SELECT count(*) AS c FROM pg_indexes WHERE indexdef ILIKE '%hnsw%'`)).c);
  eq(n, 2, 'hnsw index count');
});

// ---------------- profile audit (added with the profile-editing feature) ----------------
await test('changing cgpa writes an audit row with old value, new value and actor', async () => {
  const admin = (await one(`SELECT user_id AS v FROM users WHERE role='admin'`)).v;
  await client.query(`SELECT set_config('hiresense.actor', $1, true)`, [String(admin)]);
  const s = await sid('PES1UG24CS101');
  await client.query('UPDATE students SET cgpa = 9.55 WHERE student_id = $1', [s]);
  const r = await one(`SELECT field, old_value, new_value, changed_by FROM student_profile_audit WHERE student_id=$1`, [s]);
  eq(r.field, 'cgpa'); eq(r.old_value, '9.10'); eq(r.new_value, '9.55'); eq(Number(r.changed_by), admin, 'actor');
});
await test('changing backlogs and department writes one audit row each (department as code)', async () => {
  const s = await sid('PES1UG24CS101');
  await client.query(`UPDATE students SET backlog_count = 2, dept_id = (SELECT dept_id FROM departments WHERE code='ECE') WHERE student_id = $1`, [s]);
  const rows = (await client.query(`SELECT field, old_value, new_value FROM student_profile_audit WHERE student_id=$1 ORDER BY field`, [s])).rows;
  eq(rows.map(r => r.field).join(','), 'backlog_count,dept_id');
  eq(rows[1].old_value, 'CSE'); eq(rows[1].new_value, 'ECE');
});
await test('changing a non-eligibility field (name) writes no audit row', async () => {
  const s = await sid('PES1UG24CS101');
  await client.query(`UPDATE students SET full_name = 'Renamed Student' WHERE student_id = $1`, [s]);
  eq(Number((await one('SELECT count(*) AS c FROM student_profile_audit WHERE student_id=$1', [s])).c), 0, 'audit rows');
});
await test('editing cgpa does not touch existing applications', async () => {
  const s = await sid('PES1UG24CS101');
  const before = (await client.query('SELECT application_id, status, match_score FROM applications WHERE student_id=$1 ORDER BY 1', [s])).rows;
  await client.query('UPDATE students SET cgpa = 5.0 WHERE student_id = $1', [s]);
  const after = (await client.query('SELECT application_id, status, match_score FROM applications WHERE student_id=$1 ORDER BY 1', [s])).rows;
  eq(JSON.stringify(after), JSON.stringify(before), 'applications unchanged');
  if (!before.length) throw new Error('test needs an existing application');
});
await test('audit rows reject an unknown field name (CHECK)', async () => {
  const s = await sid('PES1UG24CS101');
  await expectError('23514', `INSERT INTO student_profile_audit (student_id, field, old_value, new_value) VALUES ($1,'srn','a','b')`, [s]);
});

await client.end();
for (const [s, n, m] of results) console.log(`${s}  ${n}${m ? `\n      -> ${m}` : ''}`);
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

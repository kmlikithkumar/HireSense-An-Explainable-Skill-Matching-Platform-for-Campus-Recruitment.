// End-to-end API tests against a running server (npm run build && npm start).
// MUTATES the database: run `npm run db:setup` afterwards to restore the sample data.
// Usage: BASE_URL=http://localhost:3000 npm run test:api
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
let passed = 0, failed = 0;

function session() {
  let cookie = '';
  return async (path, { method, body, redirect } = {}) => {
    const res = await fetch(BASE + path, {
      method: method ?? (body ? 'POST' : 'GET'),
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      redirect: redirect ?? 'manual',
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, data, location: res.headers.get('location') };
  };
}
async function test(name, fn) {
  try { await fn(); console.log(`PASS  ${name}`); passed++; }
  catch (e) { console.log(`FAIL  ${name}\n      -> ${e.message}`); failed++; }
}
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m ?? 'value'}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); };

const anon = session(), student = session(), admin = session();

await test('unauthenticated API call is rejected (401)', async () => eq((await anon('/api/student/matches')).status, 401));
await test('protected page redirects to /login without a session', async () => {
  const r = await anon('/admin'); eq(r.status, 307); eq(new URL(r.location, BASE).pathname, '/login');
});
await test('wrong password is rejected (401)', async () =>
  eq((await anon('/api/auth/login', { body: { email: 'student01@hiresense.test', password: 'wrong-password' } })).status, 401));
await test('unknown email gives the same 401', async () =>
  eq((await anon('/api/auth/login', { body: { email: 'nobody@hiresense.test', password: 'whatever1' } })).status, 401));
await test('malformed login body is rejected (422)', async () =>
  eq((await anon('/api/auth/login', { body: { email: 'not-an-email', password: 'x' } })).status, 422));

await test('student logs in', async () => {
  const r = await student('/api/auth/login', { body: { email: 'student01@hiresense.test', password: 'Student@123' } });
  eq(r.status, 200); eq(r.data.role, 'student');
});
await test('student can read ranked matches with skill explanations', async () => {
  const r = await student('/api/student/matches'); eq(r.status, 200);
  if (!r.data.length) throw new Error('no matches');
  if (!('matched_skills' in r.data[0])) throw new Error('missing matched_skills');
});
await test('student is forbidden from admin API (403)', async () => eq((await student('/api/admin/dashboard')).status, 403));
await test('student is redirected away from /admin pages', async () => {
  const r = await student('/admin'); eq(r.status, 307); eq(new URL(r.location, BASE).pathname, '/student');
});
await test('applying to an ineligible posting is blocked by the database (422 + reason)', async () => {
  const jobs = (await student('/api/jobs')).data;
  const j = jobs.find((x) => x.title === 'Mechanical Design Engineer');  // wrong department for a CSE student
  const r = await student('/api/student/applications', { body: { jobId: j.job_id } });
  eq(r.status, 422); if (!/Department/.test(r.data.error)) throw new Error(r.data.error);
});
await test('applying to an eligible posting works and stores a match score', async () => {
  const jobs = (await student('/api/jobs')).data;
  const j = jobs.find((x) => x.title === 'Cloud and DevOps Engineer');
  const r = await student('/api/student/applications', { body: { jobId: j.job_id } });
  eq(r.status, 201); if (r.data.match_score == null) throw new Error('no score');
});
await test('applying twice is a conflict (409)', async () => {
  const j = (await student('/api/jobs')).data.find((x) => x.title === 'Cloud and DevOps Engineer');
  eq((await student('/api/student/applications', { body: { jobId: j.job_id } })).status, 409);
});
await test('full-text search narrows results; hostile input is harmless', async () => {
  const r = await student('/api/jobs?q=kubernetes'); eq(r.status, 200); eq(r.data.length, 1);
  const inj = await student(`/api/jobs?q=${encodeURIComponent("x'; DROP TABLE students; --")}`);
  eq(inj.status, 200);
  eq((await student('/api/student/profile')).status, 200);   // tables still exist
});
await test('saving a resume re-extracts skills', async () => {
  const r = await student('/api/student/profile', { method: 'PUT', body: { resumeText: 'I build Kubernetes platforms on AWS with Docker and write Python automation.' } });
  eq(r.status, 200);
  const p = (await student('/api/student/profile')).data;
  for (const s of ['Kubernetes', 'AWS', 'Docker', 'Python']) if (!p.skills.includes(s)) throw new Error(`missing skill ${s}`);
  eq(p.has_embedding, true);
});
await test('too-short resume is rejected (422)', async () =>
  eq((await student('/api/student/profile', { method: 'PUT', body: { resumeText: 'short' } })).status, 422));

await test('registration validates SRN format (422)', async () => {
  const r = await anon('/api/auth/register', { body: { email: 'new@hiresense.test', password: 'Passw0rdX', fullName: 'New Student', srn: 'bad', deptId: 1, cgpa: 8, backlogCount: 0, gradYear: 2028 } });
  eq(r.status, 422);
});
await test('registration rejects CGPA above 10 (422)', async () => {
  const r = await anon('/api/auth/register', { body: { email: 'new@hiresense.test', password: 'Passw0rdX', fullName: 'New Student', srn: 'PES1UG24CS999', deptId: 1, cgpa: 11, backlogCount: 0, gradYear: 2028 } });
  eq(r.status, 422);
});
await test('registration creates a student session; duplicate email is 409', async () => {
  const s2 = session();
  const body = { email: `reg${Date.now()}@hiresense.test`, password: 'Passw0rdX', fullName: 'New Student', srn: `PES1UG24CS${String(Date.now()).slice(-3)}`, deptId: 1, cgpa: 8.2, backlogCount: 0, gradYear: 2028,
    resumeText: 'Backend developer using PostgreSQL, Node.js and REST APIs with Docker.' };
  eq((await s2('/api/auth/register', { body })).status, 201);
  eq((await s2('/api/student/profile')).status, 200);
  eq((await anon('/api/auth/register', { body })).status, 409);
});

await test('admin logs in and sees the dashboard', async () => {
  eq((await admin('/api/auth/login', { body: { email: 'admin@hiresense.test', password: 'Admin@123' } })).status, 200);
  const d = await admin('/api/admin/dashboard'); eq(d.status, 200);
  if (!d.data.companies.length || !d.data.skillGap.length) throw new Error('dashboard empty');
});
let cvJob;
await test('admin sees candidates ranked by similarity, eligible only', async () => {
  const jobs = (await admin('/api/admin/jobs')).data;
  cvJob = jobs.find((j) => j.title === 'Computer Vision Engineer');
  const r = await admin(`/api/admin/jobs/${cvJob.job_id}/candidates`); eq(r.status, 200);
  const c = r.data.candidates;
  for (let i = 1; i < c.length; i++) if (Number(c[i - 1].similarity) < Number(c[i].similarity)) throw new Error('not sorted');
  if (!c.every((x) => x.is_eligible)) throw new Error('ineligible student listed');
});
await test('admin shortlists an applied candidate; rerun is a conflict (409)', async () => {
  const backend = (await admin('/api/admin/jobs')).data.find((j) => j.title === 'Backend Engineer');
  const apps = (await admin(`/api/admin/jobs/${backend.job_id}/applications`)).data;
  const target = apps.find((a) => a.status === 'applied');
  if (!target) throw new Error('no applied candidate to test with');
  const when = new Date(Date.now() + 86400000).toISOString();
  eq((await admin(`/api/admin/applications/${target.application_id}/shortlist`, { body: { roundType: 'technical', scheduledAt: when } })).status, 201);
  eq((await admin(`/api/admin/applications/${target.application_id}/shortlist`, { body: { roundType: 'technical', scheduledAt: when } })).status, 409);
});
await test('illegal transition (applied -> selected) is blocked (409)', async () => {
  const jobs = (await admin('/api/admin/jobs')).data;
  for (const j of jobs) {
    const a = (await admin(`/api/admin/jobs/${j.job_id}/applications`)).data.find((x) => x.status === 'applied');
    if (a) return eq((await admin(`/api/admin/applications/${a.application_id}/decision`, { body: { status: 'selected' } })).status, 409);
  }
  throw new Error('no applied application found');
});
await test('admin creates a posting that is embedded and rankable', async () => {
  const deadline = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
  const r = await admin('/api/admin/jobs', { body: { companyName: 'Test Co', title: 'Platform Engineer', jdText: 'Operate Kubernetes clusters on AWS, automate with Python and Docker, build CI/CD pipelines.', minCgpa: 7, maxBacklogs: 1, deadline, deptIds: [], skillIds: [] } });
  eq(r.status, 201);
  const c = await admin(`/api/admin/jobs/${r.data.jobId}/candidates`); eq(c.status, 200);
  if (!c.data.candidates.length) throw new Error('no ranked candidates');
});
await test('invalid posting is rejected (422)', async () =>
  eq((await admin('/api/admin/jobs', { body: { companyName: '', title: 'x', jdText: 'short', minCgpa: 99, maxBacklogs: -1, deadline: 'tomorrow', deptIds: [], skillIds: [] } })).status, 422));
await test('logout clears access', async () => {
  const s3 = session();
  await s3('/api/auth/login', { body: { email: 'student02@hiresense.test', password: 'Student@123' } });
  eq((await s3('/api/student/profile')).status, 200);
  await s3('/api/auth/logout', { method: 'POST' });
  eq((await s3('/api/student/profile')).status, 401);
});

// ---------------- profile editing (added with the profile feature) ----------------
const pe = session();
let peBefore;
await pe('/api/auth/login', { body: { email: 'student03@hiresense.test', password: 'Student@123' } });
await test('profile GET now includes email, dept_id and recent_changes', async () => {
  const r = await pe('/api/student/profile'); eq(r.status, 200);
  eq(r.data.email, 'student03@hiresense.test'); eq(typeof r.data.dept_id, 'number'); eq(Array.isArray(r.data.recent_changes), true);
  peBefore = r.data;
});
await test('PATCH details updates own details and reports eligibility counts', async () => {
  const apps0 = (await pe('/api/student/applications')).data;
  const r = await pe('/api/student/profile/details', { method: 'PATCH', body: { fullName: 'Rohan K Iyer', cgpa: 8.9, gradYear: 2028 } });
  eq(r.status, 200); eq(r.data.profile.full_name, 'Rohan K Iyer'); eq(Number(r.data.profile.cgpa), 8.9);
  eq(typeof r.data.eligibleOpenPostings.before, 'number', 'before count'); eq(typeof r.data.eligibleOpenPostings.after, 'number', 'after count');
  const p = (await pe('/api/student/profile')).data;
  eq(p.full_name, 'Rohan K Iyer'); eq(p.srn, peBefore.srn, 'srn unchanged');
  eq(p.recent_changes.some((c) => c.field === 'cgpa' && Number(c.new_value) === 8.9), true, 'audit shows the cgpa change');
  eq(JSON.stringify((await pe('/api/student/applications')).data), JSON.stringify(apps0), 'applications untouched');
});
await test('PATCH cgpa 11 is rejected (422) with a field error', async () => {
  const r = await pe('/api/student/profile/details', { method: 'PATCH', body: { cgpa: 11 } });
  eq(r.status, 422); eq(typeof r.data.fields.cgpa, 'string');
});
await test('PATCH backlogCount -1 is rejected (422)', async () => {
  const r = await pe('/api/student/profile/details', { method: 'PATCH', body: { backlogCount: -1 } });
  eq(r.status, 422); eq(typeof r.data.fields.backlogCount, 'string');
});
await test('PATCH with 3 decimal places is rejected rather than silently rounded (422)', async () =>
  eq((await pe('/api/student/profile/details', { method: 'PATCH', body: { cgpa: 8.123 } })).status, 422));
await test('PATCH unknown department is rejected (422)', async () =>
  eq((await pe('/api/student/profile/details', { method: 'PATCH', body: { deptId: 99999 } })).status, 422));
await test('PATCH cannot change srn or role (422) and nothing changes', async () => {
  eq((await pe('/api/student/profile/details', { method: 'PATCH', body: { srn: 'PES1UG24CS999' } })).status, 422);
  eq((await pe('/api/student/profile/details', { method: 'PATCH', body: { role: 'admin', cgpa: 9 } })).status, 422);
  const p = (await pe('/api/student/profile')).data;
  eq(p.srn, peBefore.srn); eq(Number(p.cgpa), 8.9, 'cgpa not changed by the rejected request');
  eq((await pe('/api/admin/dashboard')).status, 403, 'still a student');
});
await test('PATCH cannot target another student (studentId in body is rejected)', async () => {
  eq((await pe('/api/student/profile/details', { method: 'PATCH', body: { studentId: 1, cgpa: 1 } })).status, 422);
  const other = session();
  await other('/api/auth/login', { body: { email: 'student01@hiresense.test', password: 'Student@123' } });
  eq(Number((await other('/api/student/profile')).data.cgpa), 9.1, 'other student unchanged');
});
await test('PATCH with an empty body is rejected (422)', async () =>
  eq((await pe('/api/student/profile/details', { method: 'PATCH', body: {} })).status, 422));
await test('PATCH as admin is forbidden (403) and unauthenticated is 401', async () => {
  eq((await admin('/api/student/profile/details', { method: 'PATCH', body: { cgpa: 9 } })).status, 403);
  eq((await anon('/api/student/profile/details', { method: 'PATCH', body: { cgpa: 9 } })).status, 401);
});
await test('admin sees the profile edit on the candidate list', async () => {
  const jobs = (await admin('/api/admin/jobs')).data;
  const nlp = jobs.find((j) => j.title === 'NLP and Retrieval Engineer');
  const rows = (await admin(`/api/admin/jobs/${nlp.job_id}/candidates?all=1`)).data.candidates;
  const rohan = rows.find((c) => c.srn === peBefore.srn);
  eq(rohan.profile_changes.length >= 1, true, 'profile_changes present');
});
await test('password change: wrong current 403, weak new 422, success lets the new password log in', async () => {
  const email = `pw${Date.now()}@hiresense.test`;
  const s5 = session();
  eq((await s5('/api/auth/register', { body: { email, password: 'Passw0rdX', fullName: 'Pw Tester', srn: `PES1UG24CS${String(Date.now()).slice(-3)}`, deptId: 1, cgpa: 8, backlogCount: 0, gradYear: 2028 } })).status, 201);
  eq((await s5('/api/student/password', { body: { currentPassword: 'wrong-pass1', newPassword: 'Another1pass' } })).status, 403);
  eq((await s5('/api/student/password', { body: { currentPassword: 'Passw0rdX', newPassword: 'short' } })).status, 422);
  eq((await s5('/api/student/password', { body: { currentPassword: 'Passw0rdX', newPassword: 'Another1pass' } })).status, 200);
  const old = session(), fresh = session();
  eq((await old('/api/auth/login', { body: { email, password: 'Passw0rdX' } })).status, 401, 'old password');
  eq((await fresh('/api/auth/login', { body: { email, password: 'Another1pass' } })).status, 200, 'new password');
  eq((await anon('/api/student/password', { body: { currentPassword: 'a', newPassword: 'Another1pass' } })).status, 401);
});
await test('email change: needs the password, rejects an email already in use (409), then works', async () => {
  const email = `em${Date.now()}@hiresense.test`;
  const s6 = session();
  eq((await s6('/api/auth/register', { body: { email, password: 'Passw0rdX', fullName: 'Em Tester', srn: `PES1UG24CS${String(Date.now() + 1).slice(-3)}`, deptId: 1, cgpa: 8, backlogCount: 0, gradYear: 2028 } })).status, 201);
  eq((await s6('/api/student/email', { body: { newEmail: 'x1@hiresense.test', password: 'wrong-pass1' } })).status, 403);
  eq((await s6('/api/student/email', { body: { newEmail: 'student01@hiresense.test', password: 'Passw0rdX' } })).status, 409);
  const fresh = `em2${Date.now()}@hiresense.test`;
  eq((await s6('/api/student/email', { body: { newEmail: fresh, password: 'Passw0rdX' } })).status, 200);
  eq((await session()('/api/auth/login', { body: { email: fresh, password: 'Passw0rdX' } })).status, 200);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

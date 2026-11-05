'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/http';
import AuthShell from '@/components/AuthShell';
import StudentFields, { Dept, StudentValues } from '@/components/StudentFields';
import { Btn, Field } from '@/components/ui';

export default function Register() {
  const router = useRouter();
  const [depts, setDepts] = useState<Dept[]>([]);
  const [v, setV] = useState<StudentValues>({ fullName: '', srn: '', deptId: '', cgpa: '', backlogCount: '0', gradYear: '2028' });
  const [acct, setAcct] = useState({ email: '', password: '', resumeText: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<Dept[]>('/api/departments').then(setDepts).catch(() => {}); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(''); setErrs({});
    try {
      await api('/api/auth/register', { body: {
        email: acct.email, password: acct.password, fullName: v.fullName, srn: v.srn.toUpperCase(),
        deptId: Number(v.deptId), cgpa: Number(v.cgpa), backlogCount: Number(v.backlogCount),
        gradYear: Number(v.gradYear), resumeText: acct.resumeText || undefined } });
      router.push('/student'); router.refresh();
    } catch (e) {
      if (e instanceof ApiError) setErrs(e.fields);
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <AuthShell>
      <h1>Create your student account</h1>
      <p className="sub">Your CGPA and backlog count decide which postings you can apply to.</p>
      <form onSubmit={submit} className="grid" style={{ gap: 16 }}>
        <StudentFields values={v} onChange={(k, x) => setV({ ...v, [k]: x })} errors={errs} depts={depts} idPrefix="reg" />
        <div className="row">
          <Field label="Email" htmlFor="reg-email" error={errs.email}>
            <input id="reg-email" type="email" required value={acct.email} aria-invalid={errs.email ? true : undefined}
              onChange={(e) => setAcct({ ...acct, email: e.target.value })} autoComplete="email" />
          </Field>
          <Field label="Password" htmlFor="reg-password" error={errs.password} help="8+ characters with a letter and a digit">
            <input id="reg-password" type="password" required minLength={8} value={acct.password} aria-invalid={errs.password ? true : undefined}
              onChange={(e) => setAcct({ ...acct, password: e.target.value })} autoComplete="new-password" />
          </Field>
        </div>
        <Field label="Resume text (optional, you can add it later)" htmlFor="reg-resume" error={errs.resumeText}>
          <textarea id="reg-resume" value={acct.resumeText} onChange={(e) => setAcct({ ...acct, resumeText: e.target.value })}
            placeholder="Paste your resume text: projects, skills, experience" />
        </Field>
        {err && <div className="err" role="alert" style={{ margin: 0 }}>{err}</div>}
        <Btn variant="primary" loading={busy} type="submit">{busy ? 'Creating...' : 'Create account'}</Btn>
      </form>
      <p className="small muted" style={{ marginTop: 20 }}>Already registered? <Link href="/login">Log in</Link></p>
    </AuthShell>
  );
}

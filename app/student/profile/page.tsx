'use client';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError, fmtDate } from '@/lib/http';
import StudentFields, { Dept, StudentValues } from '@/components/StudentFields';
import { Btn, Field, Icon, SkeletonRows, initials } from '@/components/ui';
import { useToast } from '@/components/Toast';

type Change = { field: string; old_value: string | null; new_value: string | null; changed_at: string };
type Profile = {
  full_name: string; srn: string; dept_code: string; dept_id: number; email: string; cgpa: string; backlog_count: number;
  grad_year: number; resume_text: string | null; has_embedding: boolean; embedding_model: string | null;
  skills: string[]; recent_changes: Change[];
};
const FIELD_LABEL: Record<string, string> = { cgpa: 'CGPA', backlog_count: 'Backlogs', dept_id: 'Department' };
const ELIGIBILITY_KEYS: (keyof StudentValues)[] = ['cgpa', 'backlogCount', 'deptId'];
type Tab = 'details' | 'resume' | 'security';

const toValues = (p: Profile): StudentValues => ({
  fullName: p.full_name, srn: p.srn, deptId: String(p.dept_id), cgpa: String(p.cgpa),
  backlogCount: String(p.backlog_count), gradYear: String(p.grad_year),
});
const same = (k: keyof StudentValues, a: StudentValues, b: StudentValues) =>
  k === 'cgpa' ? Number(a[k]) === Number(b[k]) : a[k].trim() === b[k].trim();

function ProfileInner() {
  const toast = useToast();
  const router = useRouter();
  const sp = useSearchParams();
  const initialTab = (['details', 'resume', 'security'] as const).find((t) => t === sp.get('tab')) ?? 'details';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [p, setP] = useState<Profile | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [v, setV] = useState<StudentValues | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [resume, setResume] = useState('');
  const [savingResume, setSavingResume] = useState(false);

  const load = useCallback(async () => {
    const prof = await api<Profile>('/api/student/profile');
    setP(prof); setV(toValues(prof)); setResume(prof.resume_text ?? '');
  }, []);
  useEffect(() => {
    load().catch((e) => toast.err((e as Error).message));
    api<Dept[]>('/api/departments').then(setDepts).catch(() => {});
  }, [load, toast]);

  const base = useMemo(() => (p ? toValues(p) : null), [p]);
  const changedKeys = useMemo(
    () => (v && base ? (Object.keys(v) as (keyof StudentValues)[]).filter((k) => k !== 'srn' && !same(k, v, base)) : []),
    [v, base]);
  const dirty = changedKeys.length > 0;
  const resumeDirty = p != null && resume !== (p.resume_text ?? '');
  const touchesEligibility = changedKeys.some((k) => ELIGIBILITY_KEYS.includes(k));

  // Warn before closing or reloading the tab with unsaved edits.
  useEffect(() => {
    if (!dirty && !resumeDirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty, resumeDirty]);

  function switchTab(t: Tab) {
    if (t === tab) return;
    if ((dirty || resumeDirty) && !window.confirm('You have unsaved changes. Leave this tab and discard them?')) return;
    if (v && base) setV(base);
    if (p) setResume(p.resume_text ?? '');
    setErrs({});
    setTab(t);
    router.replace(`/student/profile?tab=${t}`, { scroll: false });
  }

  async function saveDetails() {
    if (!v || !base) return;
    setSaving(true); setErrs({});
    const body: Record<string, string | number> = {};
    if (changedKeys.includes('fullName')) body.fullName = v.fullName.trim();
    if (changedKeys.includes('deptId')) body.deptId = Number(v.deptId);
    if (changedKeys.includes('cgpa')) body.cgpa = Number(v.cgpa);
    if (changedKeys.includes('backlogCount')) body.backlogCount = Number(v.backlogCount);
    if (changedKeys.includes('gradYear')) body.gradYear = Number(v.gradYear);
    try {
      const r = await api<{ eligibleOpenPostings: { before: number; after: number } }>(
        '/api/student/profile/details', { method: 'PATCH', body });
      await load();   // UI shows server state only after the server confirmed
      router.refresh(); // header name
      const { before, after } = r.eligibleOpenPostings;
      toast.ok(touchesEligibility
        ? `Profile saved. You are now eligible for ${after} open posting${after === 1 ? '' : 's'} (was ${before}).`
        : 'Profile saved.');
    } catch (e) {
      if (e instanceof ApiError) setErrs(e.fields);
      toast.err((e as Error).message);
    } finally { setSaving(false); }
  }

  async function saveResume() {
    setSavingResume(true);
    try {
      await api('/api/student/profile', { method: 'PUT', body: { resumeText: resume } });
      await load(); toast.ok('Resume saved. It was re-embedded and your skills were refreshed.');
    } catch (e) { toast.err((e as Error).message); } finally { setSavingResume(false); }
  }

  if (!p || !v) return <><h1>Profile</h1><SkeletonRows rows={5} cols={2} /></>;

  return (
    <>
      <div className="profile-head">
        <span className="avatar avatar-lg" aria-hidden="true">{initials(p.full_name)}</span>
        <div>
          <h1 style={{ marginBottom: 2 }}>{p.full_name}</h1>
          <div className="muted small">{p.srn} · {p.dept_code} · {p.email}</div>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Profile sections">
        {([['details', 'Details'], ['resume', 'Resume'], ['security', 'Account and security']] as const).map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => switchTab(t)}>{label}</button>))}
      </div>

      {tab === 'details' && (
        <>
          <div className="card">
            <h3>Your details</h3>
            <p className="sub" style={{ marginBottom: 16 }}>These are used to check which postings you can apply to.</p>
            <StudentFields values={v} onChange={(k, x) => { setV({ ...v, [k]: x }); if (errs[k]) setErrs({ ...errs, [k]: '' }); }}
              errors={errs} depts={depts} srnReadOnly idPrefix="pf" />
            {touchesEligibility && (
              <div className="note" role="status" style={{ marginTop: 20 }}>
                <b>Changing these affects which postings you are eligible for. Existing applications are not changed.</b>
                <br />Placement staff can see changes to CGPA, backlogs and department.
              </div>)}
          </div>

          <div className="savebar">
            <span className="small muted" aria-live="polite">{dirty ? `${changedKeys.length} unsaved change${changedKeys.length === 1 ? '' : 's'}` : 'All changes saved'}</span>
            <div className="actions">
              <Btn onClick={() => { setV(base); setErrs({}); }} disabled={!dirty || saving}>Discard</Btn>
              <Btn variant="primary" onClick={saveDetails} loading={saving} disabled={!dirty}>Save changes</Btn>
            </div>
          </div>

          <h2>Recent changes to eligibility details</h2>
          {p.recent_changes.length === 0 ? <p className="muted small">No changes recorded.</p> : (
            <ul className="history card flat" style={{ padding: 12 }}>
              {p.recent_changes.map((c, i) => (
                <li key={i}><span className="chip violet">{FIELD_LABEL[c.field] ?? c.field}</span>
                  <span>{c.old_value ?? '-'} <span className="muted">→</span> <b>{c.new_value ?? '-'}</b></span>
                  <time dateTime={c.changed_at}>{fmtDate(c.changed_at)}</time></li>))}
            </ul>)}
        </>
      )}

      {tab === 'resume' && (
        <>
          <div className="card">
            <h3>Resume text</h3>
            <p className="sub" style={{ marginBottom: 16 }}>This text is turned into a vector and compared with every job description.</p>
            <Field label="Resume" htmlFor="resume-text" help={`${resume.length} / 8000 characters`}>
              <textarea id="resume-text" style={{ minHeight: 280 }} value={resume} maxLength={8000} onChange={(e) => setResume(e.target.value)}
                placeholder="Projects, skills, internships, coursework. Plain text works best." />
            </Field>
          </div>
          <div className="savebar">
            <span className="small muted">{resumeDirty ? 'Unsaved changes' : 'All changes saved'}</span>
            <div className="actions">
              <Btn onClick={() => setResume(p.resume_text ?? '')} disabled={!resumeDirty || savingResume}>Discard</Btn>
              <Btn variant="primary" onClick={saveResume} loading={savingResume} disabled={!resumeDirty || resume.trim().length < 30}>Save resume</Btn>
            </div>
          </div>
          <h2>Skills found in your resume</h2>
          <p>{p.skills.length ? p.skills.map((s) => <span key={s} className="chip ok"><Icon name="check" size={12} />{s}</span>) : <span className="muted">None found yet.</span>}</p>
          <p className="small muted">Embedding: {p.has_embedding ? `stored (${p.embedding_model})` : 'not generated yet'}</p>
        </>
      )}

      {tab === 'security' && <SecurityTab email={p.email} onEmail={load} />}
    </>
  );
}

function SecurityTab({ email, onEmail }: { email: string; onEmail: () => Promise<void> }) {
  const toast = useToast();
  const router = useRouter();
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwErr, setPwErr] = useState<Record<string, string>>({});
  const [pwBusy, setPwBusy] = useState(false);
  const [em, setEm] = useState({ newEmail: '', password: '' });
  const [emErr, setEmErr] = useState<Record<string, string>>({});
  const [emBusy, setEmBusy] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault(); setPwBusy(true); setPwErr({});
    try {
      await api('/api/student/password', { body: pw });
      setPw({ currentPassword: '', newPassword: '' }); toast.ok('Password changed.');
    } catch (err) { if (err instanceof ApiError) setPwErr(err.fields); toast.err((err as Error).message); } finally { setPwBusy(false); }
  }
  async function changeEmail(e: React.FormEvent) {
    e.preventDefault(); setEmBusy(true); setEmErr({});
    try {
      await api('/api/student/email', { body: em });
      setEm({ newEmail: '', password: '' }); await onEmail(); router.refresh(); toast.ok('Email changed. Use it the next time you log in.');
    } catch (err) { if (err instanceof ApiError) setEmErr(err.fields); toast.err((err as Error).message); } finally { setEmBusy(false); }
  }

  return (
    <div className="grid g2">
      <form className="card" onSubmit={changeEmail}>
        <h3>Login email</h3>
        <p className="sub" style={{ marginBottom: 16 }}>Currently <b>{email}</b>. Enter your password to change it.</p>
        <div className="grid" style={{ gap: 14 }}>
          <Field label="New email" htmlFor="em-new" error={emErr.newEmail}>
            <input id="em-new" type="email" required value={em.newEmail} aria-invalid={emErr.newEmail ? true : undefined}
              onChange={(e) => setEm({ ...em, newEmail: e.target.value })} autoComplete="email" />
          </Field>
          <Field label="Current password" htmlFor="em-pw" error={emErr.password}>
            <input id="em-pw" type="password" required value={em.password} aria-invalid={emErr.password ? true : undefined}
              onChange={(e) => setEm({ ...em, password: e.target.value })} autoComplete="current-password" />
          </Field>
          <Btn variant="primary" type="submit" loading={emBusy} disabled={!em.newEmail || !em.password}>Change email</Btn>
        </div>
      </form>
      <form className="card" onSubmit={changePassword}>
        <h3>Password</h3>
        <p className="sub" style={{ marginBottom: 16 }}>Use 8 or more characters with a letter and a digit.</p>
        <div className="grid" style={{ gap: 14 }}>
          <Field label="Current password" htmlFor="pw-cur" error={pwErr.currentPassword}>
            <input id="pw-cur" type="password" required value={pw.currentPassword} aria-invalid={pwErr.currentPassword ? true : undefined}
              onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" />
          </Field>
          <Field label="New password" htmlFor="pw-new" error={pwErr.newPassword}>
            <input id="pw-new" type="password" required minLength={8} value={pw.newPassword} aria-invalid={pwErr.newPassword ? true : undefined}
              onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" />
          </Field>
          <Btn variant="primary" type="submit" loading={pwBusy} disabled={!pw.currentPassword || pw.newPassword.length < 8}>Change password</Btn>
        </div>
      </form>
    </div>
  );
}

export default function ProfilePage() {
  return <Suspense fallback={<SkeletonRows rows={5} cols={2} />}><ProfileInner /></Suspense>;
}

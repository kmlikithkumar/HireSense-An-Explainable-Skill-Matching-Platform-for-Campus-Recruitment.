'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/http';
import { Btn, Field } from '@/components/ui';
import { useToast } from '@/components/Toast';

type Dept = { dept_id: number; code: string; name: string };
type Skill = { skill_id: number; name: string };

export default function NewJob() {
  const router = useRouter();
  const toast = useToast();
  const [depts, setDepts] = useState<Dept[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [f, setF] = useState({ companyName: '', industry: '', title: '', jdText: '', minCgpa: '7.5', maxBacklogs: '0', ctcLpa: '', deadline: '' });
  const [deptIds, setDeptIds] = useState<number[]>([]);
  const [skillIds, setSkillIds] = useState<number[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Dept[]>('/api/departments').then(setDepts).catch(() => {});
    api<Skill[]>('/api/admin/skills').then(setSkills).catch(() => {});
  }, []);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });
  const toggle = (arr: number[], id: number, setter: (v: number[]) => void) =>
    setter(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  const inv = (k: string) => (errs[k] ? true : undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErrs({});
    try {
      const r = await api<{ jobId: number }>('/api/admin/jobs', { body: {
        companyName: f.companyName, industry: f.industry || undefined, title: f.title, jdText: f.jdText,
        minCgpa: Number(f.minCgpa), maxBacklogs: Number(f.maxBacklogs), ctcLpa: f.ctcLpa ? Number(f.ctcLpa) : undefined,
        deadline: f.deadline, deptIds, skillIds } });
      toast.ok('Posting created'); router.push(`/admin/jobs/${r.jobId}`);
    } catch (e) {
      if (e instanceof ApiError) setErrs(e.fields);
      toast.err((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <>
      <h1>New posting</h1>
      <p className="sub">The description is embedded when you save, so students can be matched right away.</p>
      <form onSubmit={submit} className="card grid" style={{ gap: 18 }}>
        <div className="row">
          <Field label="Company" htmlFor="np-company" error={errs.companyName}><input id="np-company" required value={f.companyName} onChange={set('companyName')} aria-invalid={inv('companyName')} /></Field>
          <Field label="Industry" htmlFor="np-industry" error={errs.industry}><input id="np-industry" value={f.industry} onChange={set('industry')} /></Field>
        </div>
        <Field label="Role title" htmlFor="np-title" error={errs.title}><input id="np-title" required value={f.title} onChange={set('title')} aria-invalid={inv('title')} /></Field>
        <Field label="Job description" htmlFor="np-jd" error={errs.jdText} help="At least 40 characters. The more specific, the better the matching.">
          <textarea id="np-jd" required value={f.jdText} onChange={set('jdText')} aria-invalid={inv('jdText')} /></Field>
        <div className="row">
          <Field label="Minimum CGPA" htmlFor="np-cgpa" error={errs.minCgpa}><input id="np-cgpa" type="number" step="0.01" min="0" max="10" required value={f.minCgpa} onChange={set('minCgpa')} aria-invalid={inv('minCgpa')} /></Field>
          <Field label="Max active backlogs" htmlFor="np-backlogs" error={errs.maxBacklogs}><input id="np-backlogs" type="number" min="0" required value={f.maxBacklogs} onChange={set('maxBacklogs')} aria-invalid={inv('maxBacklogs')} /></Field>
          <Field label="CTC (LPA)" htmlFor="np-ctc" error={errs.ctcLpa}><input id="np-ctc" type="number" step="0.1" min="0" value={f.ctcLpa} onChange={set('ctcLpa')} /></Field>
          <Field label="Apply by" htmlFor="np-deadline" error={errs.deadline}><input id="np-deadline" type="date" required value={f.deadline} onChange={set('deadline')} aria-invalid={inv('deadline')} /></Field>
        </div>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>Eligible departments (none selected = all)</legend>
          <div className="actions" style={{ gap: 16 }}>{depts.map((d) => (
            <label key={d.dept_id} className="inline-check"><input type="checkbox" checked={deptIds.includes(d.dept_id)} onChange={() => toggle(deptIds, d.dept_id, setDeptIds)} />{d.code}</label>))}</div>
        </fieldset>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>Required skills</legend>
          <div className="actions" style={{ gap: '8px 16px' }}>{skills.map((s) => (
            <label key={s.skill_id} className="inline-check"><input type="checkbox" checked={skillIds.includes(s.skill_id)} onChange={() => toggle(skillIds, s.skill_id, setSkillIds)} />{s.name}</label>))}</div>
        </fieldset>
        <div><Btn variant="primary" type="submit" loading={busy}>{busy ? 'Saving...' : 'Create posting'}</Btn></div>
      </form>
    </>
  );
}

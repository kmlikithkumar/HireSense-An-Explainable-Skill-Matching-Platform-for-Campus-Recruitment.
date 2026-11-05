'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtDate } from '@/lib/http';
import { Btn, EmptyState, Icon, ScoreRing, SkeletonRows, StatusChip } from '@/components/ui';
import { useToast } from '@/components/Toast';

type Change = { field: string; old_value: string | null; new_value: string | null; changed_at: string };
type Cand = {
  student_id: number; full_name: string; srn: string; dept_code: string; cgpa: string; similarity: string;
  is_eligible: boolean; reason: string; matched_skills: string[]; missing_skills: string[];
  application_id: number | null; application_status: string | null; profile_changes: Change[];
};
type Round = { round_id: number; round_no: number; round_type: string; scheduled_at: string | null; result: string };
type App = {
  application_id: number; status: string; match_score: string | null; full_name: string; srn: string; cgpa: string;
  dept_code: string; rounds: Round[]; profile_changes: Change[];
};
type Data = { job: { title: string; company_name: string; status: string; min_cgpa: string; max_backlogs: number; skills: string[] }; candidates: Cand[] };
const LABEL: Record<string, string> = { cgpa: 'CGPA', backlog_count: 'Backlogs', dept_id: 'Department' };

/** Small badge shown when a student edited CGPA, backlogs or department. The tooltip lists the latest changes. */
function EditedBadge({ changes }: { changes: Change[] }) {
  if (!changes?.length) return null;
  const tip = changes.map((c) => `${LABEL[c.field] ?? c.field}: ${c.old_value ?? '-'} → ${c.new_value ?? '-'} (${fmtDate(c.changed_at)})`).join('\n');
  return <span className="chip warn" title={tip} aria-label={`Profile edited. ${tip.replace(/\n/g, '; ')}`} tabIndex={0}><Icon name="user" size={12} />profile edited</span>;
}

export default function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [apps, setApps] = useState<App[] | null>(null);
  const [all, setAll] = useState(false);
  const [roundType, setRoundType] = useState('technical');
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([
        api<Data>(`/api/admin/jobs/${id}/candidates${all ? '?all=1' : ''}`),
        api<App[]>(`/api/admin/jobs/${id}/applications`)]);
      setData(d); setApps(a);
    } catch (e) { toast.err((e as Error).message); }
  }, [id, all, toast]);
  useEffect(() => { load(); }, [load]);

  async function act(key: string, ok: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try { await fn(); toast.ok(ok); await load(); } catch (e) { toast.err((e as Error).message); } finally { setBusy(null); }
  }
  const shortlist = (appId: number) => act(`s${appId}`, 'Shortlisted and round 1 scheduled', () => {
    if (!when) throw new Error('Pick a date and time for the first round');
    return api(`/api/admin/applications/${appId}/shortlist`, { body: { roundType, scheduledAt: new Date(when).toISOString() } });
  });
  const decide = (appId: number, status: 'selected' | 'rejected') =>
    act(`d${appId}${status}`, status === 'selected' ? 'Candidate selected' : 'Application rejected',
      () => api(`/api/admin/applications/${appId}/decision`, { body: { status } }));
  const result = (roundId: number, r: 'pass' | 'fail') =>
    act(`r${roundId}${r}`, `Round marked ${r}`, () => api(`/api/admin/rounds/${roundId}`, { method: 'PATCH', body: { result: r } }));

  if (!data || !apps) return <><h1>Posting</h1><SkeletonRows rows={5} cols={4} /></>;
  const { job } = data;

  return (
    <>
      <p className="small"><Link href="/admin/jobs">← All postings</Link></p>
      <div className="page-head">
        <div>
          <h1>{job.title}</h1>
          <p className="sub" style={{ marginBottom: 6 }}>{job.company_name} · CGPA ≥ {job.min_cgpa} · backlogs ≤ {job.max_backlogs} · <StatusChip status={job.status} /></p>
        </div>
      </div>
      <p>{job.skills.map((s) => <span key={s} className="chip violet">{s}</span>)}</p>

      <h2>Applications</h2>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row" style={{ alignItems: 'end' }}>
          <div className="field"><label htmlFor="rt">First round type</label>
            <select id="rt" value={roundType} onChange={(e) => setRoundType(e.target.value)}>
              {['aptitude', 'technical', 'hr', 'group'].map((t) => <option key={t}>{t}</option>)}</select></div>
          <div className="field"><label htmlFor="rw">Date and time</label><input id="rw" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
        </div>
        <p className="small muted" style={{ margin: '10px 0 0' }}>Shortlisting changes the status and creates round 1 in one database transaction.</p>
      </div>
      {apps.length === 0 ? <EmptyState icon="users" title="No applications yet">Students who apply will show up here.</EmptyState> : (
        <div className="tablewrap"><table className="stack">
          <thead><tr><th>Student</th><th>Match</th><th>Status</th><th>Rounds</th><th>Actions</th></tr></thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.application_id}>
                <td data-label="Student"><b>{a.full_name}</b> <EditedBadge changes={a.profile_changes} /><br /><span className="muted small">{a.srn} · {a.dept_code} · CGPA {a.cgpa}</span></td>
                <td data-label="Match"><ScoreRing value={a.match_score} size={44} /></td>
                <td data-label="Status"><StatusChip status={a.status} /></td>
                <td data-label="Rounds" className="small">{a.rounds.map((r) => (
                  <div key={r.round_id} style={{ marginBottom: 4 }}>#{r.round_no} {r.round_type} · {fmtDate(r.scheduled_at)} ·{' '}
                    {r.result === 'pending'
                      ? <span className="actions" style={{ display: 'inline-flex' }}>
                          <Btn className="sm" loading={busy === `r${r.round_id}pass`} onClick={() => result(r.round_id, 'pass')}>Pass</Btn>
                          <Btn className="sm" loading={busy === `r${r.round_id}fail`} onClick={() => result(r.round_id, 'fail')}>Fail</Btn></span>
                      : <StatusChip status={r.result} />}</div>))}
                  {!a.rounds.length && <span className="muted">-</span>}</td>
                <td><div className="actions">
                  {a.status === 'applied' && <Btn variant="primary" className="sm" loading={busy === `s${a.application_id}`} onClick={() => shortlist(a.application_id)}>Shortlist</Btn>}
                  {a.status === 'shortlisted' && <Btn variant="primary" className="sm" loading={busy === `d${a.application_id}selected`} onClick={() => decide(a.application_id, 'selected')}>Select</Btn>}
                  {['applied', 'shortlisted'].includes(a.status) && <Btn variant="danger" className="sm" loading={busy === `d${a.application_id}rejected`} onClick={() => decide(a.application_id, 'rejected')}>Reject</Btn>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table></div>)}

      <div className="page-head" style={{ marginTop: 36 }}>
        <h2 style={{ margin: 0 }}>Students ranked by resume similarity</h2>
        <label className="inline-check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />Include students who are not eligible</label>
      </div>
      <div className="tablewrap" style={{ marginTop: 12 }}><table className="stack">
        <thead><tr><th>Student</th><th>Similarity</th><th>Skills</th><th>Eligibility</th><th>Application</th></tr></thead>
        <tbody>
          {data.candidates.map((c) => (
            <tr key={c.student_id}>
              <td data-label="Student"><b>{c.full_name}</b> <EditedBadge changes={c.profile_changes} /><br /><span className="muted small">{c.srn} · {c.dept_code} · CGPA {c.cgpa}</span></td>
              <td data-label="Similarity"><ScoreRing value={c.similarity} size={46} /></td>
              <td data-label="Skills" className="small">{c.matched_skills.map((s) => <span key={s} className="chip ok"><Icon name="check" size={12} />{s}</span>)}{c.missing_skills.map((s) => <span key={s} className="chip miss">{s}</span>)}</td>
              <td data-label="Eligibility" className="small">{c.is_eligible ? <span className="chip ok"><span className="dot" />Eligible</span> : <><span className="chip bad"><span className="dot" />Not eligible</span><br /><span className="muted">{c.reason}</span></>}</td>
              <td data-label="Application">{c.application_status ? <StatusChip status={c.application_status} /> : <span className="muted small">not applied</span>}</td>
            </tr>
          ))}
          {data.candidates.length === 0 && <tr><td colSpan={5} className="muted">No candidates to show.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}

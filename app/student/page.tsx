'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtDate, fmtDay } from '@/lib/http';
import { Btn, EmptyState, Icon, ScoreRing, SkeletonRows, StatusChip } from '@/components/ui';
import { useToast } from '@/components/Toast';

type Match = {
  job_id: number; title: string; company_name: string; similarity: string; is_eligible: boolean; reason: string;
  matched_skills: string[]; missing_skills: string[]; ctc_lpa: string | null; deadline: string; application_status: string | null;
};
type App = {
  application_id: number; status: string; match_score: string | null; applied_at: string; title: string;
  company_name: string; next_interview_at: string | null; rounds_total: number;
};

export default function StudentHome() {
  const toast = useToast();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [apps, setApps] = useState<App[] | null>(null);
  const [onlyEligible, setOnlyEligible] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, a] = await Promise.all([api<Match[]>('/api/student/matches'), api<App[]>('/api/student/applications')]);
      setMatches(m); setApps(a);
    } catch (e) { toast.err((e as Error).message); setMatches([]); setApps([]); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  async function apply(jobId: number) {
    setBusyId(jobId);
    try { await api('/api/student/applications', { body: { jobId } }); toast.ok('Application submitted'); await load(); }
    catch (e) { toast.err((e as Error).message); } finally { setBusyId(null); }
  }
  async function withdraw(id: number) {
    setBusyId(id);
    try { await api(`/api/student/applications/${id}`, { method: 'DELETE' }); toast.ok('Application withdrawn'); await load(); }
    catch (e) { toast.err((e as Error).message); } finally { setBusyId(null); }
  }

  const shown = (matches ?? []).filter((m) => !onlyEligible || m.is_eligible);
  const noResume = matches !== null && matches.length === 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Postings matched to your resume</h1>
          <p className="sub">Ranked by how close your resume is to each job description. Skill chips show why.</p>
        </div>
        <label className="inline-check"><input type="checkbox" checked={onlyEligible} onChange={(e) => setOnlyEligible(e.target.checked)} />Only postings I am eligible for</label>
      </div>

      {matches === null ? <SkeletonRows rows={4} cols={4} /> : noResume ? (
        <EmptyState icon="file" title="No matches yet"
          action={<Link className="btn primary" href="/student/profile?tab=resume">Add your resume</Link>}>
          Add or update your resume text so it can be compared with postings.
        </EmptyState>
      ) : (
        <div className="tablewrap"><table className="stack">
          <thead><tr><th>Posting</th><th>Match</th><th>Skills</th><th>Eligibility</th><th></th></tr></thead>
          <tbody>
            {shown.map((m) => (
              <tr key={m.job_id}>
                <td data-label="Posting"><b>{m.title}</b><br /><span className="muted small">{m.company_name}{m.ctc_lpa ? ` · ${m.ctc_lpa} LPA` : ''} · apply by {fmtDay(m.deadline)}</span></td>
                <td data-label="Match"><ScoreRing value={m.similarity} /></td>
                <td data-label="Skills" className="small">
                  {m.matched_skills.map((s) => <span key={s} className="chip ok"><Icon name="check" size={12} />{s}</span>)}
                  {m.missing_skills.map((s) => <span key={s} className="chip miss" title="Asked for, not found in your resume">{s}</span>)}
                  {!m.matched_skills.length && !m.missing_skills.length && <span className="muted">No tagged skills</span>}
                </td>
                <td data-label="Eligibility" className="small">{m.is_eligible ? <span className="chip ok"><span className="dot" />Eligible</span>
                  : <><span className="chip bad"><span className="dot" />Not eligible</span><br /><span className="muted">{m.reason}</span></>}</td>
                <td>{m.application_status ? <StatusChip status={m.application_status} />
                  : <Btn variant="primary" className="sm" loading={busyId === m.job_id} disabled={!m.is_eligible} onClick={() => apply(m.job_id)}>Apply</Btn>}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={5} className="muted">Nothing to show with this filter.</td></tr>}
          </tbody>
        </table></div>
      )}
      <p className="small muted" style={{ marginTop: 10 }}>Green chips are skills in your resume that the posting asks for. Dashed chips are asked for but not found in your resume.</p>

      <h2>My applications</h2>
      {apps === null ? <SkeletonRows rows={2} cols={4} /> : apps.length === 0 ? (
        <EmptyState icon="briefcase" title="No applications yet">Apply to a matched posting above and it will appear here.</EmptyState>
      ) : (
        <div className="tablewrap"><table className="stack">
          <thead><tr><th>Posting</th><th>Status</th><th>Match at apply time</th><th>Next interview</th><th></th></tr></thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.application_id}>
                <td data-label="Posting"><b>{a.title}</b><br /><span className="muted small">{a.company_name} · applied {fmtDay(a.applied_at)}</span></td>
                <td data-label="Status"><StatusChip status={a.status} /></td>
                <td data-label="Match at apply time"><ScoreRing value={a.match_score} size={44} /></td>
                <td data-label="Next interview" className="small">{fmtDate(a.next_interview_at)}</td>
                <td>{['applied', 'shortlisted'].includes(a.status) &&
                  <Btn variant="danger" className="sm" loading={busyId === a.application_id} onClick={() => withdraw(a.application_id)}>Withdraw</Btn>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </>
  );
}

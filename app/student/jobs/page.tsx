'use client';
import { useEffect, useState } from 'react';
import { api, fmtDay } from '@/lib/http';
import { Btn, EmptyState, Icon, SkeletonRows } from '@/components/ui';
import { useToast } from '@/components/Toast';

type Job = {
  job_id: number; title: string; company_name: string; ctc_lpa: string | null; min_cgpa: string; max_backlogs: number;
  deadline: string; summary: string; departments: string[]; is_eligible: boolean | null; reason: string | null;
};

export default function Jobs() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function search(term: string) {
    try { setJobs(await api<Job[]>(`/api/jobs?q=${encodeURIComponent(term)}`)); } catch (e) { toast.err((e as Error).message); setJobs([]); }
  }
  useEffect(() => { search(''); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function apply(id: number) {
    setBusyId(id);
    try { await api('/api/student/applications', { body: { jobId: id } }); toast.ok('Application submitted'); await search(q); }
    catch (e) { toast.err((e as Error).message); } finally { setBusyId(null); }
  }

  return (
    <>
      <h1>Search postings</h1>
      <p className="sub">Keyword search (PostgreSQL full-text). For meaning-based ranking, see "My matches".</p>
      <form onSubmit={(e) => { e.preventDefault(); search(q); }} className="actions" style={{ marginBottom: 20, flexWrap: 'nowrap' }} role="search">
        <input aria-label="Search postings" placeholder='e.g. kubernetes, "computer vision", sql -java' value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="primary" style={{ flex: 'none' }}><Icon name="search" size={16} />Search</button>
      </form>
      {jobs === null ? <SkeletonRows rows={3} cols={2} /> : jobs.length === 0 ? (
        <EmptyState icon="search" title="No postings match that search">Try fewer or different words.</EmptyState>
      ) : (
        <div className="grid">
          {jobs.map((j) => (
            <div key={j.job_id} className="card">
              <div className="page-head" style={{ marginBottom: 4, alignItems: 'baseline' }}>
                <div><b style={{ fontSize: 17 }}>{j.title}</b> <span className="muted">· {j.company_name}</span></div>
                <div className="small muted">{j.ctc_lpa ? `${j.ctc_lpa} LPA · ` : ''}apply by {fmtDay(j.deadline)}</div>
              </div>
              <p className="small" style={{ margin: '6px 0' }}>{j.summary}...</p>
              <p className="small muted">Min CGPA {j.min_cgpa} · max backlogs {j.max_backlogs} · {j.departments.length ? j.departments.join(', ') : 'all departments'}</p>
              <div className="actions">
                {j.is_eligible
                  ? <Btn variant="primary" loading={busyId === j.job_id} onClick={() => apply(j.job_id)}>Apply</Btn>
                  : <><span className="chip bad"><span className="dot" />Not eligible</span><span className="small muted">{j.reason}</span></>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

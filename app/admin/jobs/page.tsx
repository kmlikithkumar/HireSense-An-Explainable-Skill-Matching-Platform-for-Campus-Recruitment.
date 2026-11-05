'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtDay } from '@/lib/http';
import { Btn, EmptyState, Icon, SkeletonRows, StatusChip } from '@/components/ui';
import { useToast } from '@/components/Toast';

type Job = { job_id: number; title: string; company_name: string; status: string; deadline: string; min_cgpa: string; max_backlogs: number; ctc_lpa: string | null; applications: number };

export default function AdminJobs() {
  const toast = useToast();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const load = () => api<Job[]>('/api/admin/jobs').then(setJobs).catch((e) => { toast.err(e.message); setJobs([]); });
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function toggle(j: Job) {
    setBusyId(j.job_id);
    try {
      await api(`/api/admin/jobs/${j.job_id}`, { method: 'PATCH', body: { status: j.status === 'open' ? 'closed' : 'open' } });
      toast.ok(j.status === 'open' ? 'Posting closed' : 'Posting reopened'); await load();
    } catch (e) { toast.err((e as Error).message); } finally { setBusyId(null); }
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Postings</h1><p className="sub">Open a posting to see students ranked by similarity.</p></div>
        <Link className="btn primary" href="/admin/jobs/new"><Icon name="briefcase" size={16} />New posting</Link>
      </div>
      {jobs === null ? <SkeletonRows rows={4} cols={5} /> : jobs.length === 0 ? (
        <EmptyState icon="briefcase" title="No postings yet" action={<Link className="btn primary" href="/admin/jobs/new">Create the first posting</Link>}>
          Add a posting and students are matched to it right away.</EmptyState>
      ) : (
        <div className="tablewrap"><table className="stack">
          <thead><tr><th>Posting</th><th>Rules</th><th>Deadline</th><th>Applications</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.job_id}>
                <td data-label="Posting"><Link href={`/admin/jobs/${j.job_id}`}><b>{j.title}</b></Link><br /><span className="muted small">{j.company_name}</span></td>
                <td data-label="Rules" className="small">CGPA ≥ {j.min_cgpa}<br />backlogs ≤ {j.max_backlogs}</td>
                <td data-label="Deadline" className="small">{fmtDay(j.deadline)}</td>
                <td data-label="Applications">{j.applications}</td>
                <td data-label="Status"><StatusChip status={j.status} /></td>
                <td><Btn className="sm" loading={busyId === j.job_id} onClick={() => toggle(j)}>{j.status === 'open' ? 'Close' : 'Reopen'}</Btn></td>
              </tr>
            ))}
          </tbody>
        </table></div>)}
    </>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/http';
import { EmptyState, Icon, SkeletonRows, StatusChip } from '@/components/ui';
import { useToast } from '@/components/Toast';

type Dash = {
  totals: { students: number; open_jobs: number; applications: number; avg_match_score: string | null };
  byStatus: { status: string; n: number }[];
  companies: { company_id: number; company_name: string; postings: number; applications: number; shortlisted: number; selected: number; shortlist_rate_pct: string | null; avg_match_score: string | null }[];
  skillGap: { name: string; postings_requiring: number; students_with: number }[];
};

export default function AdminDashboard() {
  const toast = useToast();
  const [d, setD] = useState<Dash | null>(null);
  useEffect(() => { api<Dash>('/api/admin/dashboard').then(setD).catch((e) => toast.err(e.message)); }, [toast]);
  if (!d) return <><h1>Placement dashboard</h1><SkeletonRows rows={4} cols={5} /></>;
  const T = d.totals;
  const tiles = [
    ['users', 't1', T.students, 'Students'], ['briefcase', 't2', T.open_jobs, 'Open postings'],
    ['file', 't3', T.applications, 'Applications'], ['trend', 't4', T.avg_match_score ?? '-', 'Average match score'],
  ] as const;
  return (
    <>
      <h1>Placement dashboard</h1>
      <p className="sub">Placement Analytics</p>
      <div className="grid g4">
        {tiles.map(([icon, t, val, label]) => (
          <div key={label} className="card stat"><span className={`ico ${t}`}><Icon name={icon} size={22} /></span><div><b>{val}</b><span>{label}</span></div></div>))}
      </div>

      <h2>Applications by status</h2>
      <p>{d.byStatus.length ? d.byStatus.map((s) => <span key={s.status} style={{ marginRight: 6 }}><StatusChip status={s.status} /><b style={{ marginRight: 8 }}>{s.n}</b></span>) : <span className="muted">No applications yet.</span>}</p>

      <h2>By company</h2>
      {d.companies.length === 0 ? <EmptyState icon="briefcase" title="No companies yet" /> : (
        <div className="tablewrap"><table className="stack">
          <thead><tr><th>Company</th><th>Postings</th><th>Applications</th><th>Shortlisted</th><th>Selected</th><th>Shortlist rate</th><th>Avg match</th></tr></thead>
          <tbody>{d.companies.map((c) => (
            <tr key={c.company_id}><td data-label="Company"><b>{c.company_name}</b></td><td data-label="Postings">{c.postings}</td><td data-label="Applications">{c.applications}</td>
              <td data-label="Shortlisted">{c.shortlisted}</td><td data-label="Selected">{c.selected}</td>
              <td data-label="Shortlist rate">{c.shortlist_rate_pct == null ? '-' : `${c.shortlist_rate_pct}%`}</td><td data-label="Avg match">{c.avg_match_score ?? '-'}</td></tr>
          ))}</tbody>
        </table></div>)}

      <h2>Skill gap: asked for by open postings, rare among students</h2>
      <div className="tablewrap"><table className="stack">
        <thead><tr><th>Skill</th><th>Open postings requiring it</th><th>Students with it</th></tr></thead>
        <tbody>{d.skillGap.map((s) => (
          <tr key={s.name}><td data-label="Skill"><b>{s.name}</b></td><td data-label="Open postings requiring it">{s.postings_requiring}</td>
            <td data-label="Students with it"><span className={`chip ${s.students_with === 0 ? 'bad' : s.students_with < 3 ? 'warn' : 'ok'}`}>{s.students_with}</span></td></tr>
        ))}</tbody>
      </table></div>
    </>
  );
}

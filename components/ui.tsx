import type { ReactNode } from 'react';

/* ---------- icons (inline SVG, 24px grid, stroke follows currentColor) ---------- */
const PATHS: Record<string, ReactNode> = {
  logo: <><path d="M4 8.5 12 4l8 4.5-8 4.5-8-4.5Z" /><path d="m4 12.5 8 4.5 8-4.5" /><path d="m4 16.5 8 4.5 8-4.5" opacity=".6" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></>,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  trend: <path d="m3 17 6-6 4 4 8-8M15 7h6v6" />,
  inbox: <><path d="M3 13l3-8h12l3 8" /><path d="M3 13v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6h-5l-1 3h-6l-1-3H3Z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  shield: <><path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></>,
  spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
};
export function Icon({ name, size = 20 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[name]}</svg>
  );
}

export function Spinner() { return <span className="spinner" aria-hidden="true" />; }

/** Button with a loading state. Extra props pass through to <button>. */
export function Btn({ loading, children, variant, ...rest }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return (
    <button {...rest} className={[variant ?? '', rest.className ?? ''].join(' ').trim()}
      disabled={rest.disabled || loading} aria-busy={loading || undefined}>
      {loading && <Spinner />}{children}
    </button>
  );
}

/* ---------- status chip ---------- */
const STATUS: Record<string, string> = {
  applied: 'info', shortlisted: 'violet', selected: 'ok', rejected: 'bad', withdrawn: '', open: 'ok', closed: '',
  pending: 'warn', pass: 'ok', fail: 'bad',
};
export function StatusChip({ status }: { status: string }) {
  return <span className={`chip ${STATUS[status] ?? ''}`}><span className="dot" />{status}</span>;
}

/* ---------- match score ring ---------- */
export function ScoreRing({ value, size = 52 }: { value: number | string | null; size?: number }) {
  if (value == null) return <span className="muted">-</span>;
  const n = Math.max(0, Math.min(1, Number(value)));
  const pct = Math.round(n * 100);
  return (
    <span className={`ring ${n >= 0.6 ? 'hi' : ''}`} style={{ ['--p' as string]: pct, ['--size' as string]: `${size}px` }}
      role="img" aria-label={`Match score ${pct} percent`}>
      <b>{pct}%</b>
    </span>
  );
}

/* ---------- loading and empty states ---------- */
export function SkeletonRows({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="tablewrap" aria-busy="true" aria-label="Loading">
      <table><tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>{Array.from({ length: cols }).map((__, c) => (
            <td key={c}><div className="skeleton" style={{ width: `${55 + ((r * 7 + c * 13) % 40)}%` }} /></td>))}</tr>))}
      </tbody></table>
    </div>
  );
}
export function EmptyState({ icon = 'inbox', title, children, action }:
  { icon?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty card flat">
      <Icon name={icon} size={36} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/* ---------- form field wrapper ---------- */
export function Field({ label, htmlFor, error, help, children }:
  { label: string; htmlFor: string; error?: string; help?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <div className="field-err" id={`${htmlFor}-err`} role="alert">{error}</div>
        : help ? <div className="help">{help}</div> : null}
    </div>
  );
}
export function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

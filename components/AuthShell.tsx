import { Icon } from './ui';

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <section className="auth-brand" aria-label="About HireSense">
        <h2>Placements that explain themselves.</h2>
        <p>HireSense compares what your resume says with what each posting needs, and shows you why.</p>
        <ul>
          <li><Icon name="spark" size={18} />Meaning-based matching, not keyword luck</li>
          <li><Icon name="shield" size={18} />Eligibility rules checked by the database, the same for everyone</li>
          <li><Icon name="trend" size={18} />See which skills you have and which you are missing</li>
        </ul>
      </section>
      <section className="auth-form"><div className="inner">{children}</div></section>
    </div>
  );
}

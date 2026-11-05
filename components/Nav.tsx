'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

// ---- Mobile hamburger nav ----
export function HamburgerNav({ role }: { role?: 'student' | 'admin' | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.mobile-nav') && !target.closest('.nav-hamburger')) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  if (!role) return null;

  return (
    <>
      <button
        className="nav-hamburger"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          /* X icon */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        ) : (
          /* Hamburger icon */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        )}
      </button>
      <nav className={`mobile-nav${open ? ' open' : ''}`} role="navigation" aria-label="Mobile navigation">
        {role === 'student' && (
          <>
            <Link href="/student" className="nav-link" onClick={() => setOpen(false)}>My matches</Link>
            <Link href="/student/jobs" className="nav-link" onClick={() => setOpen(false)}>Search postings</Link>
            <Link href="/student/profile" className="nav-link" onClick={() => setOpen(false)}>Profile &amp; resume</Link>
          </>
        )}
        {role === 'admin' && (
          <>
            <Link href="/admin" className="nav-link" onClick={() => setOpen(false)}>Dashboard</Link>
            <Link href="/admin/jobs" className="nav-link" onClick={() => setOpen(false)}>Postings</Link>
          </>
        )}
      </nav>
    </>
  );
}

// ---- Theme toggle ----
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = (() => { try { return localStorage.getItem('hs-theme'); } catch { return null; } })();
    const isDark = stored === 'dark';
    setDark(isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const val = next ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', val);
    try { localStorage.setItem('hs-theme', val); } catch { /* ignore */ }
  }

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? (
        /* Sun icon */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
        </svg>
      ) : (
        /* Moon icon */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}

// ---- Active nav link ----
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
  return (
    <Link href={href} className={`nav-link${isActive ? ' nav-link-active' : ''}`}>
      {children}
    </Link>
  );
}

// ---- Avatar dropdown (includes logout) ----
export function AvatarMenu({ name, role }: { name: string; role: 'student' | 'admin' }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Initials from the name
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="avatar-menu" ref={ref}>
      <button
        className="avatar-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
      >
        <span className="avatar-circle">{initials}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div className="avatar-dropdown" role="menu">
          <div className="avatar-name">{name}</div>
          {role === 'student' && (
            <Link href="/student/profile" className="avatar-item" role="menuitem" onClick={() => setOpen(false)}>
              Profile &amp; resume
            </Link>
          )}
          <button className="avatar-item avatar-item-danger" role="menuitem" onClick={logout}>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Legacy LogoutButton (keep for any remaining references) ----
export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
      }}
    >
      Log out
    </button>
  );
}

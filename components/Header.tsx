'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon, initials } from './ui';

type Props = { role: 'student' | 'admin' | null; name: string };

const LINKS = {
  student: [['/student', 'My matches'], ['/student/jobs', 'Search postings'], ['/student/profile', 'Profile']],
  admin: [['/admin', 'Dashboard'], ['/admin/jobs', 'Postings']],
} as const;

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => { setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'); }, []);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('hs-theme', next); } catch { /* storage can be blocked */ }
  };
  return { theme, toggle };
}

export default function Header({ role, name }: Props) {
  const path = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', click); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key); };
  }, [open]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login'); router.refresh();
  }
  const isActive = (href: string) => (href === '/student' || href === '/admin' ? path === href : path.startsWith(href));

  return (
    <header className="top">
      <div className="in">
        <Link href="/" className="brand"><span className="logo-mark"><Icon name="logo" size={18} /></span>HireSense</Link>
        {role && (
          <nav aria-label="Main">
            {LINKS[role].map(([href, label]) => (
              <Link key={href} href={href} aria-current={isActive(href) ? 'page' : undefined}>{label}</Link>))}
          </nav>
        )}
        <div className="hdr-actions" style={role ? undefined : { marginLeft: 'auto' }}>
          <button className="icon-btn" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
          {role && (
            <div className="menu-wrap" ref={ref}>
              <button className="avatar" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}
                aria-label="Account menu">{initials(name)}</button>
              {open && (
                <div className="menu" role="menu">
                  <div className="who"><b>{name}</b><span>{role}</span></div>
                  {role === 'student' && <Link href="/student/profile" role="menuitem"><Icon name="user" size={17} />Profile and settings</Link>}
                  <button role="menuitem" className="danger-item" onClick={logout}><Icon name="logout" size={17} />Log out</button>
                </div>)}
            </div>)}
        </div>
      </div>
    </header>
  );
}

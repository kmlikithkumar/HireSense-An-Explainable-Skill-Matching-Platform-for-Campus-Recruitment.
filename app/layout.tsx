import './globals.css';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import Header from '@/components/Header';
import { ToastProvider } from '@/components/Toast';

// Inter is vendored in app/fonts so builds do not need to reach Google Fonts.
const inter = localFont({ src: './fonts/Inter-latin-var.woff2', variable: '--font-inter', display: 'swap', weight: '100 900' });

export const metadata: Metadata = {
  title: 'HireSense',
  description: 'Explainable skill-matching platform for campus recruitment',
};

// Runs before first paint so there is no flash. Light is the default; dark only if the user chose it.
const THEME_SCRIPT = `try{var t=localStorage.getItem('hs-theme');document.documentElement.dataset.theme=t==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}`;

async function displayName(role: 'student' | 'admin', sid: number | null): Promise<string> {
  if (role === 'admin') return 'Placement admin';
  try {
    const r = await query<{ full_name: string }>('SELECT full_name FROM students WHERE student_id = $1', [sid]);
    return r.rows[0]?.full_name ?? 'Student';
  } catch {
    return 'Student';
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const name = session ? await displayName(session.role, session.sid) : '';
  return (
    <html lang="en" className={inter.variable} data-theme="light" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body>
        <ToastProvider>
          <Header role={session?.role ?? null} name={name} />
          <main>{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}

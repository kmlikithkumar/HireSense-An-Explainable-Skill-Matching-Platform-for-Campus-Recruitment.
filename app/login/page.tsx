'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/http';
import AuthShell from '@/components/AuthShell';
import { Btn, Field } from '@/components/ui';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await api<{ role: string }>('/api/auth/login', { body: { email, password } });
      router.push(r.role === 'admin' ? '/admin' : '/student');
      router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <AuthShell>
      <h1>Welcome back</h1>
      <p className="sub">Log in as a student or as placement staff.</p>
      <form onSubmit={submit} className="grid" style={{ gap: 16 }}>
        <Field label="Email" htmlFor="login-email">
          <input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </Field>
        <Field label="Password" htmlFor="login-password">
          <div className="pw-wrap">
            <input id="login-password" type={show ? 'text' : 'password'} required value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <button type="button" className="ghost sm" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
          </div>
        </Field>
        {err && <div className="err" role="alert" style={{ margin: 0 }}>{err}</div>}
        <Btn variant="primary" loading={busy} type="submit">{busy ? 'Signing in...' : 'Log in'}</Btn>
      </form>
      <p className="small muted" style={{ marginTop: 20 }}>New student? <Link href="/register">Create an account</Link></p>
    </AuthShell>
  );
}

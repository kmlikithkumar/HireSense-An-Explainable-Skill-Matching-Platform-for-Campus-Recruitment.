'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Icon } from './ui';

type T = { id: number; kind: 'ok' | 'err'; text: string };
const Ctx = createContext<{ ok: (t: string) => void; err: (t: string) => void }>({ ok: () => {}, err: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const n = useRef(0);
  const dismiss = useCallback((id: number) => setItems((x) => x.filter((i) => i.id !== id)), []);
  const push = useCallback((kind: T['kind'], text: string) => {
    const id = ++n.current;
    setItems((x) => [...x.slice(-3), { id, kind, text }]);
    setTimeout(() => dismiss(id), kind === 'err' ? 7000 : 4000);
  }, [dismiss]);
  const api = useMemo(() => ({ ok: (t: string) => push('ok', t), err: (t: string) => push('err', t) }), [push]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'err' ? 'alert' : 'status'}>
            <span style={{ color: t.kind === 'ok' ? 'var(--ok)' : 'var(--bad)' }}><Icon name={t.kind === 'ok' ? 'check' : 'x'} size={18} /></span>
            <span>{t.text}</span>
            <button aria-label="Dismiss" onClick={() => dismiss(t.id)}><Icon name="x" size={16} /></button>
          </div>))}
      </div>
    </Ctx.Provider>
  );
}

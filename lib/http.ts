// Small fetch wrapper for client components. Throws an Error (message = server "error") on non-2xx.
export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  constructor(message: string, status: number, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export async function api<T = any>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? (init?.body ? 'POST' : 'GET'),
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.fields ?? {});
  return data as T;
}

export const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
export const fmtDay = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '-';
export const pct = (x: number | string | null) => (x == null ? '-' : `${Math.round(Number(x) * 100)}%`);

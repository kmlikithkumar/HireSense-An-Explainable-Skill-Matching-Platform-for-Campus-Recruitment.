import { NextResponse } from 'next/server';
import { ZodError, ZodTypeAny, z } from 'zod';
import { getSession, Session } from './auth';

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** Role gate for route handlers. Returns the session or a ready-made error response. */
export async function requireRole(role: Session['role']): Promise<Session | NextResponse> {
  const s = await getSession();
  if (!s) return fail('Not signed in', 401);
  if (s.role !== role) return fail('Forbidden for your role', 403);
  return s;
}
export const isResponse = (x: unknown): x is NextResponse => x instanceof NextResponse;

export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S> | NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail('Request body must be JSON');
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    return NextResponse.json({ error: formatZod(r.error), fields: fieldErrors(r.error) }, { status: 422 });
  }
  return r.data;
}

/** First message per field, keyed by the field path ("_" when the issue is about the whole body). */
function fieldErrors(e: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const k = i.path.join('.') || '_';
    if (!(k in out)) out[k] = i.message;
  }
  return out;
}

function formatZod(e: ZodError): string {
  return e.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
}

/** Translate PostgreSQL errors (including our HS00x trigger errors) into HTTP responses. */
export function dbError(err: unknown): NextResponse {
  const e = err as { code?: string; message?: string; constraint?: string };
  switch (e.code) {
    case 'HS001': return fail(e.message ?? 'Not eligible', 422);
    case 'HS002': return fail(e.message ?? 'Illegal status change', 409);
    case 'HS003': return fail(e.message ?? 'Not found', 404);
    case '23505': return fail('That record already exists', 409);
    case '23514': return fail(`Value rejected by database rule (${e.constraint ?? 'check'})`, 422);
    case '23503': return fail('Referenced record does not exist', 422);
    case '22P02': return fail('Invalid value', 422);
  }
  console.error('[api] unexpected database error', err);
  return fail('Internal error', 500);
}

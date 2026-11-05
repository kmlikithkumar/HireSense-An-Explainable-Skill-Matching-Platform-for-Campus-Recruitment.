import { z } from 'zod';
import { query } from '@/lib/db';
import { dbError, fail, json, parseBody, requireRole, isResponse } from '@/lib/api';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole('admin');
  if (isResponse(s)) return s;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return fail('Invalid id', 422);
  const b = await parseBody(req, z.object({ status: z.enum(['open', 'closed']) }));
  if (isResponse(b)) return b;
  try {
    const r = await query('UPDATE job_postings SET status = $1 WHERE job_id = $2', [b.status, id]);
    return r.rowCount ? json({ ok: true }) : fail('Posting not found', 404);
  } catch (e) {
    return dbError(e);
  }
}

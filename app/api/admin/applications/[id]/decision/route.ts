import { z } from 'zod';
import { withTransaction } from '@/lib/db';
import { dbError, fail, json, parseBody, requireRole, isResponse } from '@/lib/api';

// Legal transitions are enforced by the database trigger (HS002), not here.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole('admin');
  if (isResponse(s)) return s;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return fail('Invalid id', 422);
  const b = await parseBody(req, z.object({ status: z.enum(['selected', 'rejected']) }));
  if (isResponse(b)) return b;
  try {
    const n = await withTransaction(async (c) => {
      await c.query(`SELECT set_config('hiresense.actor', $1, true)`, [String(s.uid)]);
      return (await c.query('UPDATE applications SET status = $1 WHERE application_id = $2', [b.status, id])).rowCount;
    });
    return n ? json({ ok: true }) : fail('Application not found', 404);
  } catch (e) {
    return dbError(e);
  }
}

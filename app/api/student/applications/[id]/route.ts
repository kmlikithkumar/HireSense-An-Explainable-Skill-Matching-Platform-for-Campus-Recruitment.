import { withTransaction } from '@/lib/db';
import { dbError, fail, json, requireRole, isResponse } from '@/lib/api';

// Students can only withdraw their own application.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole('student');
  if (isResponse(s)) return s;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return fail('Invalid id', 422);
  try {
    const n = await withTransaction(async (c) => {
      await c.query(`SELECT set_config('hiresense.actor', $1, true)`, [String(s.uid)]);
      const r = await c.query(
        `UPDATE applications SET status = 'withdrawn' WHERE application_id = $1 AND student_id = $2`, [id, s.sid]);
      return r.rowCount;
    });
    return n ? json({ ok: true }) : fail('Application not found', 404);
  } catch (e) {
    return dbError(e);
  }
}

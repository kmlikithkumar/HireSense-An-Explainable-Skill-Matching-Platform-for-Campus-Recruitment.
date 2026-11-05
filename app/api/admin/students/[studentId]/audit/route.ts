import { query } from '@/lib/db';
import { json, requireRole, isResponse } from '@/lib/api';

/** Return the last 5 profile-audit rows for a specific student (admin only). */
export async function GET(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const s = await requireRole('admin');
  if (isResponse(s)) return s;

  const { studentId } = await params;
  const id = Number(studentId);
  if (!Number.isInteger(id) || id <= 0) {
    const { fail } = await import('@/lib/api');
    return fail('Invalid student id', 400);
  }

  const r = await query(
    `SELECT field, old_value, new_value, changed_at
     FROM student_profile_audit
     WHERE student_id = $1
     ORDER BY changed_at DESC
     LIMIT 5`,
    [id]
  );
  return json(r.rows);
}

import { query } from '@/lib/db';
import { json, requireRole, isResponse } from '@/lib/api';

/** Return the last 20 profile-audit rows for the logged-in student. */
export async function GET() {
  const s = await requireRole('student');
  if (isResponse(s)) return s;

  const r = await query(
    `SELECT field, old_value, new_value, changed_at
     FROM student_profile_audit
     WHERE student_id = $1
     ORDER BY changed_at DESC
     LIMIT 20`,
    [s.sid]
  );
  return json(r.rows);
}

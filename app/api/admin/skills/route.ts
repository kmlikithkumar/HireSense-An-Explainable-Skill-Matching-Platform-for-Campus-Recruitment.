import { query } from '@/lib/db';
import { json, requireRole, isResponse } from '@/lib/api';

export async function GET() {
  const s = await requireRole('admin');
  if (isResponse(s)) return s;
  return json((await query('SELECT skill_id, name FROM skills ORDER BY name')).rows);
}

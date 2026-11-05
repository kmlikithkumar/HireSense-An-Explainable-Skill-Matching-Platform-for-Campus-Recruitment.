import { query } from '@/lib/db';
import { json } from '@/lib/api';

export async function GET() {
  const r = await query('SELECT dept_id, code, name FROM departments ORDER BY code');
  return json(r.rows);
}

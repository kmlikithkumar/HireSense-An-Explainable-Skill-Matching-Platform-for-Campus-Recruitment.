import { z } from 'zod';
import { query } from '@/lib/db';
import { dbError, fail, json, parseBody, requireRole, isResponse } from '@/lib/api';

// Calls the shortlist_candidate() function: status change + round 1 in one atomic step.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole('admin');
  if (isResponse(s)) return s;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return fail('Invalid id', 422);
  const b = await parseBody(req, z.object({
    roundType: z.enum(['aptitude', 'technical', 'hr', 'group']),
    scheduledAt: z.string().datetime({ offset: true }),
  }));
  if (isResponse(b)) return b;
  try {
    const r = await query('SELECT shortlist_candidate($1, $2, $3, $4) AS round_id', [id, b.roundType, b.scheduledAt, s.uid]);
    return json({ roundId: r.rows[0].round_id }, 201);
  } catch (e) {
    return dbError(e);
  }
}

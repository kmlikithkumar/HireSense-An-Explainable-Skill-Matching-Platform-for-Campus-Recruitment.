import { Pool, PoolClient, QueryResultRow } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __hsPool: Pool | undefined;
}

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  }
  return new Pool({ connectionString: url, max: 10 });
}

// One pool per process, kept across hot reloads in development.
export function pool(): Pool {
  if (!globalThis.__hsPool) globalThis.__hsPool = createPool();
  return globalThis.__hsPool;
}

export async function query<T extends QueryResultRow = any>(text: string, params: unknown[] = []) {
  return pool().query<T>(text, params);
}

/** Run several statements in one transaction (BEGIN ... COMMIT, ROLLBACK on error). */
export async function withTransaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** pgvector accepts '[0.1,0.2,...]' text; cast with ::vector in SQL. */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

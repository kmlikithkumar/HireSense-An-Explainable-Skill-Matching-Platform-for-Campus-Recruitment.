// Creates the schema, loads sample data, generates embeddings, then adds sample applications.
// Usage: npm run db:setup   (reads DATABASE_URL from .env.local; DESTROYS existing HireSense tables)
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sql = (f) => readFileSync(path.join(root, 'db', f), 'utf8');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env.local first.');
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  for (const f of ['01_schema.sql', '02_functions_triggers.sql', '03_views.sql', '07_profile_audit.sql', '04_seed.sql']) {
    process.stdout.write(`running ${f} ... `);
    await client.query(sql(f));
    console.log('ok');
  }
} finally {
  await client.end();
}

console.log('generating embeddings ...');
const r = spawnSync('npx', ['tsx', '--env-file=.env.local', 'scripts/embed.ts'], { cwd: root, stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);

const c2 = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c2.connect();
try {
  process.stdout.write('running 05_seed_applications.sql ... ');
  await c2.query(sql('05_seed_applications.sql'));
  console.log('ok');
} finally {
  await c2.end();
}
console.log('done. Demo logins are listed at the top of db/04_seed.sql.');

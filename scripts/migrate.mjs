#!/usr/bin/env node
// Apply db/migrations/*.sql once each, in order, tracked in schema_migrations.
// Runs before `vite build` on Vercel (DATABASE_URL is injected by the Neon integration).
// Skips quietly when no database is configured (local dev, CI) so those builds keep working.
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.log('migrate: no DATABASE_URL, skipping');
  process.exit(0);
}

const dir = new URL('../db/migrations/', import.meta.url);
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
await client.connect();
try {
  await client.query('select pg_advisory_lock(727274)'); // concurrent builds must not apply the same migration twice
  await client.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  const done = new Set((await client.query('select name from schema_migrations')).rows.map((r) => r.name));
  for (const f of files) {
    if (done.has(f)) continue;
    console.log(`migrate: applying ${f}`);
    await client.query('begin');
    try {
      await client.query(await readFile(new URL(f, dir), 'utf8'));
      await client.query('insert into schema_migrations (name) values ($1)', [f]);
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw e;
    }
  }
  console.log('migrate: up to date');
} finally {
  await client.end();
}

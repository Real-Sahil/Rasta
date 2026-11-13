import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

// Runs the real migration in an in-process Postgres with a minimal Supabase auth stub,
// then exercises the row-level-security rules as different users.
const migration = readFileSync(new URL('./migrations/20261113000000_incidents.sql', import.meta.url), 'utf8');
const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';
const D = '00000000-0000-0000-0000-00000000000d';

let db: PGlite;
const as = async (uid: string | null, sql: string, params: unknown[] = []) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
};
const report = (over: Record<string, unknown> = {}) => ({ category: 'accident', title: 'Crash on canal road', lat: 31.5, lng: 74.3, ...over });
const insert = (uid: string, r: Record<string, unknown>) =>
  as(uid, `insert into public.incidents (category,title,lat,lng,confirmations,hidden,expires_at)
           values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [r.category, r.title, r.lat, r.lng, r.confirmations ?? 0, r.hidden ?? false, r.expires_at ?? null]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${A}'),('${B}'),('${C}'),('${D}');
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
  `);
  await db.exec(migration);
});

describe('incidents schema + RLS', () => {
  it('lets a signed-in user report, and forces server-controlled fields', async () => {
    const r = (await insert(A, report({ confirmations: 99, hidden: true, expires_at: '2099-01-01' }))).rows[0] as any;
    expect(r.created_by).toBe(A);
    expect(r.confirmations).toBe(0);
    expect(r.hidden).toBe(false);
    expect(new Date(r.expires_at).getTime() - Date.now()).toBeLessThanOrEqual(6 * 3600_000 + 5000);
  });

  it('rejects coordinates outside Pakistan and bad titles', async () => {
    await expect(insert(A, report({ lat: 51.5, lng: -0.12 }))).rejects.toThrow();
    await expect(insert(A, report({ title: 'x' }))).rejects.toThrow();
    await expect(insert(A, report({ category: 'bogus' }))).rejects.toThrow();
  });

  it('blocks anonymous (signed-out) inserts but allows public reads of active reports', async () => {
    await expect(as(null, `insert into public.incidents (category,title,lat,lng) values ('hazard','abc',31,74)`)).rejects.toThrow();
    const rows = (await as(null, 'select * from public.incidents')).rows;
    expect(rows.length).toBeGreaterThan(0);
  });

  it('cannot spoof another user as the author', async () => {
    const r = (await as(B, `insert into public.incidents (created_by,category,title,lat,lng) values ('${A}','hazard','spoof try',31,74) returning created_by`)).rows[0] as any;
    expect(r.created_by).toBe(B); // trigger overrides it
  });

  it('hides expired reports from readers', async () => {
    await db.exec(`update public.incidents set expires_at = now() - interval '1 minute' where title = 'spoof try'`);
    const rows = (await as(null, `select title from public.incidents where title = 'spoof try'`)).rows;
    expect(rows).toHaveLength(0);
  });

  it('counts a confirmation once per user and never for your own report', async () => {
    const id = ((await insert(A, report({ title: 'Flooded underpass' }))).rows[0] as any).id;
    await as(B, 'insert into public.incident_confirmations (incident_id) values ($1)', [id]);
    await expect(as(B, 'insert into public.incident_confirmations (incident_id) values ($1)', [id])).rejects.toThrow(); // duplicate
    await expect(as(A, 'insert into public.incident_confirmations (incident_id) values ($1)', [id])).rejects.toThrow(); // own report
    const n = ((await as(C, 'select confirmations from public.incidents where id = $1', [id])).rows[0] as any).confirmations;
    expect(n).toBe(1);
  });

  it('hides a report after 3 distinct flags', async () => {
    const id = ((await insert(A, report({ title: 'Dodgy report' }))).rows[0] as any).id;
    for (const u of [B, C]) await as(u, 'insert into public.incident_flags (incident_id) values ($1)', [id]);
    expect((await as(null, 'select 1 from public.incidents where id = $1', [id])).rows).toHaveLength(1);
    await as(D, 'insert into public.incident_flags (incident_id) values ($1)', [id]);
    expect((await as(null, 'select 1 from public.incidents where id = $1', [id])).rows).toHaveLength(0);
  });

  it('clients cannot edit incidents or delete other people’s', async () => {
    const id = ((await insert(A, report({ title: 'Mine only' }))).rows[0] as any).id;
    await expect(as(A, `update public.incidents set title = 'edited' where id = $1`, [id])).rejects.toThrow();
    await as(B, 'delete from public.incidents where id = $1', [id]);
    expect((await as(null, 'select 1 from public.incidents where id = $1', [id])).rows).toHaveLength(1);
    await as(A, 'delete from public.incidents where id = $1', [id]);
    expect((await as(null, 'select 1 from public.incidents where id = $1', [id])).rows).toHaveLength(0);
  });

  it('rate-limits a user to 10 reports per hour', async () => {
    const u = '00000000-0000-0000-0000-0000000000ee';
    await db.exec(`insert into auth.users values ('${u}')`);
    for (let i = 0; i < 10; i++) await insert(u, report({ title: `spam ${i}` }));
    await expect(insert(u, report({ title: 'spam 11' }))).rejects.toThrow(/rate limit/);
  });
});

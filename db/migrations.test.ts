import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('./migrations/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

describe('migrations', () => {
  it('are numbered consecutively and apply cleanly in order', async () => {
    expect(files.map((f) => f.slice(0, 3))).toEqual(files.map((_, i) => String(i + 1).padStart(3, '0')));
    const db = new PGlite();
    for (const f of files) await db.exec(readFileSync(new URL(f, dir), 'utf8'));
  });

  it('lock the tables down: other roles (e.g. a Data API anon role) see and change nothing', async () => {
    const db = new PGlite();
    // Simulate a platform that auto-grants table access to anon/authenticated roles
    await db.exec(`
      create role anon nologin; create role authenticated nologin;
      alter default privileges in schema public grant all on tables to anon, authenticated, public;
      grant usage on schema public to anon, authenticated;
    `);
    for (const f of files) await db.exec(readFileSync(new URL(f, dir), 'utf8'));
    await db.exec(`insert into incidents (created_by, ip_hash, category, title, lat, lng)
                   values ('00000000-0000-4000-8000-000000000001', 'h', 'hazard', 'visible to owner only', 31, 74)`);
    const rls = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class where relname in ('incidents','incident_confirmations','incident_flags')`);
    expect(rls.rows.every((r) => r.relrowsecurity)).toBe(true);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await expect(db.query('select * from incidents')).rejects.toThrow(/permission denied/);
      await expect(db.query(`insert into incidents (created_by, ip_hash, category, title, lat, lng) values ('00000000-0000-4000-8000-000000000002','h','hazard','sneaky',31,74)`)).rejects.toThrow();
      await db.exec('reset role');
    }
    expect((await db.query('select count(*)::int as n from incidents')).rows[0]).toEqual({ n: 1 });
  });
});

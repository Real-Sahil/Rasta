import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { createApi, signToken, verifyToken, validateNewIncident } from './index';

const SECRET = 'test-secret';
const migrationsDir = new URL('../db/migrations/', import.meta.url);
const migration = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(new URL(f, migrationsDir), 'utf8')).join('\n');
let pg: PGlite;
let api: ReturnType<typeof createApi>;
let admin: ReturnType<typeof createApi>;
let clock = Date.now();

const call = (method: string, op: string, opts: { token?: string; body?: unknown; ip?: string } = {}) =>
  api.handle(new Request(`https://x.test/api?op=${op}`, {
    method,
    headers: { 'x-forwarded-for': opts.ip ?? '1.1.1.1', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), 'content-type': 'application/json' },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  }));
const newToken = async () => ((await (await call('POST', 'session')).json()) as any).token as string;
const report = (over: Record<string, unknown> = {}) => ({ category: 'accident', title: 'Crash on canal road', lat: 31.5, lng: 74.3, ...over });

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(migration);
  const db = async (t: string, p?: unknown[]) => (await pg.query(t, p as any[])).rows;
  api = createApi({ db, secret: SECRET, now: () => clock });
  admin = createApi({ db, secret: SECRET, now: () => clock, adminKey: 'admin-key-for-tests' });
});

describe('tokens', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  it('round-trips and rejects tampering, wrong secret and expiry', () => {
    const t = signToken(id, SECRET, 1000);
    expect(verifyToken(t, SECRET, 2000)).toBe(id);
    expect(verifyToken(t, 'other', 2000)).toBeNull();
    expect(verifyToken(t.slice(0, -2) + 'xx', SECRET, 2000)).toBeNull();
    expect(verifyToken(t, SECRET, 1000 + 91 * 24 * 3600 * 1000)).toBeNull();
    expect(verifyToken('garbage', SECRET, 1)).toBeNull();
    expect(verifyToken(null, SECRET, 1)).toBeNull();
  });
});

describe('validation', () => {
  it('accepts a minimal valid report and trims/nulls fields', () => {
    const v = validateNewIncident(report({ title: '  Pothole ', description: '  ' }));
    expect(v).toMatchObject({ ok: true, value: { title: 'Pothole', description: null } });
  });
  it('rejects bad category, short title, wrong types, oversize and out-of-Pakistan coordinates', () => {
    for (const bad of [{ category: 'x' }, { title: 'ab' }, { title: 5 }, { description: 'x'.repeat(501) }, { lat: 51.5, lng: -0.1 }, { lat: '31' }]) {
      expect(validateNewIncident(report(bad)).ok).toBe(false);
    }
    expect(validateNewIncident(null).ok).toBe(false);
  });
});

describe('incident API', () => {
  it('honours a shorter ttl_minutes, rejects bad values, and never exceeds the 6 h cap', async () => {
    const a = await newToken();
    expect((await call('POST', 'create', { token: a, body: report({ title: 'Short lived report', ttl_minutes: 10 }) })).status).toBe(201);
    for (const bad of [0, 361, 1.5, 'x']) expect((await call('POST', 'create', { token: a, body: report({ ttl_minutes: bad }) })).status).toBe(400);
    const rows = await pg.query("select extract(epoch from (expires_at - created_at))/60 as m from incidents where title = 'Short lived report'");
    expect(Math.round(Number((rows.rows[0] as any).m))).toBe(10);
  });

  it('requires a token to write but not to read', async () => {
    expect((await call('POST', 'create', { body: report() })).status).toBe(401);
    expect((await call('POST', 'create', { token: 'bad', body: report() })).status).toBe(401);
    expect((await call('GET', 'list')).status).toBe(200);
  });

  it('creates a report; server fields cannot be spoofed; list shows mine/confirmed correctly', async () => {
    const a = await newToken();
    const res = await call('POST', 'create', { token: a, body: report({ title: 'Flooded underpass', confirmations: 99, hidden: true, created_by: 'x', expires_at: '2099-01-01' }) });
    expect(res.status).toBe(201);
    const list = (await (await call('GET', 'list', { token: a })).json() as any).incidents;
    const mine = list.find((i: any) => i.title === 'Flooded underpass');
    expect(mine).toMatchObject({ confirmations: 0, mine: true, confirmed: false });
    expect(mine.created_by).toBeUndefined();
    expect(mine.ip_hash).toBeUndefined();
    const anon = (await (await call('GET', 'list')).json() as any).incidents.find((i: any) => i.id === mine.id);
    expect(anon.mine).toBe(false);
  });

  it('confirm: once per device (idempotent), never own report, counts across devices', async () => {
    const a = await newToken(), b = await newToken(), c = await newToken();
    const id = ((await (await call('POST', 'create', { token: a, body: report({ title: 'Roadblock at Mall Rd', category: 'roadblock' }) })).json()) as any).id;
    expect((await call('POST', 'act', { token: a, body: { id, action: 'confirm' } })).status).toBe(403);
    expect((await call('POST', 'act', { token: b, body: { id, action: 'confirm' } })).status).toBe(200);
    expect((await call('POST', 'act', { token: b, body: { id, action: 'confirm' } })).status).toBe(200); // duplicate = no-op
    await call('POST', 'act', { token: c, body: { id, action: 'confirm' } });
    const row = ((await (await call('GET', 'list', { token: b })).json() as any).incidents).find((i: any) => i.id === id);
    expect(row.confirmations).toBe(2);
    expect(row.confirmed).toBe(true);
  });

  it('hides a report after 3 distinct flags', async () => {
    const a = await newToken();
    const id = ((await (await call('POST', 'create', { token: a, body: report({ title: 'Dodgy report here' }) })).json()) as any).id;
    for (let i = 0; i < 3; i++) await call('POST', 'act', { token: await newToken(), body: { id, action: 'flag' } });
    const ids = ((await (await call('GET', 'list')).json() as any).incidents).map((i: any) => i.id);
    expect(ids).not.toContain(id);
  });

  it('validates action bodies and unknown reports', async () => {
    const t = await newToken();
    expect((await call('POST', 'act', { token: t, body: { id: 'nope', action: 'confirm' } })).status).toBe(400);
    expect((await call('POST', 'act', { token: t, body: { id: '22222222-2222-4222-8222-222222222222', action: 'delete' } })).status).toBe(400);
    expect((await call('POST', 'act', { token: t, body: { id: '22222222-2222-4222-8222-222222222222', action: 'confirm' } })).status).toBe(404);
  });

  it('rate-limits a device to 10 reports/hour, and an IP to 30/hour even across fresh devices', async () => {
    const t = await newToken();
    for (let i = 0; i < 10; i++) expect((await call('POST', 'create', { token: t, ip: '9.9.9.9', body: report({ title: `spam ${i} abc`, lat: 25 + i * 0.01 }) })).status).toBe(201);
    expect((await call('POST', 'create', { token: t, ip: '9.9.9.9', body: report({ title: 'spam 11 abc', lat: 26 }) })).status).toBe(429);
    let blocked = 0;
    for (let i = 0; i < 35; i++) {
      const r = await call('POST', 'create', { token: await newToken(), ip: '8.8.8.8', body: report({ title: `ip spam ${i} abc` }) });
      if (r.status === 429) blocked++;
    }
    expect(blocked).toBe(5); // 30 allowed, the rest refused
  });

  it('rejects oversized bodies and unknown operations', async () => {
    const t = await newToken();
    expect((await call('POST', 'create', { token: t, body: report({ description: 'x'.repeat(9000) }) })).status).toBe(400);
    expect((await call('GET', 'nope')).status).toBe(405);
    expect((await api.handle(new Request('https://x.test/api'))).status).toBe(404);
  });
});

describe('duplicates', () => {
  it('rejects the same headline or the same spot/category from one device, but allows others', async () => {
    const a = await newToken();
    expect((await call('POST', 'create', { token: a, ip: '9.9.9.1', body: report({ title: 'Dup test one', lat: 31.60, lng: 74.40 }) })).status).toBe(201);
    expect((await call('POST', 'create', { token: a, ip: '9.9.9.1', body: report({ title: 'DUP TEST ONE', lat: 31.70, lng: 74.50 }) })).status).toBe(409);
    expect((await call('POST', 'create', { token: a, ip: '9.9.9.1', body: report({ title: 'Another headline', lat: 31.6003, lng: 74.4003 }) })).status).toBe(409);
    expect((await call('POST', 'create', { token: a, ip: '9.9.9.1', body: report({ title: 'Different place', lat: 31.80, lng: 74.60 }) })).status).toBe(201);
    const b = await newToken();
    expect((await call('POST', 'create', { token: b, ip: '9.9.9.2', body: report({ title: 'Dup test one', lat: 31.60, lng: 74.40 }) })).status).toBe(201);
  });
});

describe('moderation and monitoring', () => {
  const adminCall = (method: string, op: string, key: string | null, body?: unknown) =>
    admin.handle(new Request(`https://x.test/api?op=${op}`, {
      method,
      headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), 'content-type': 'application/json', 'x-forwarded-for': '2.2.2.2' },
      body: body === undefined ? undefined : JSON.stringify(body)
    }));

  it('admin operations are disabled without ADMIN_KEY and need the right key with it', async () => {
    expect((await call('GET', 'admin_list')).status).toBe(404);
    expect((await adminCall('GET', 'admin_list', null)).status).toBe(401);
    expect((await adminCall('GET', 'admin_list', 'wrong')).status).toBe(401);
    expect((await adminCall('GET', 'admin_list', 'admin-key-for-tests')).status).toBe(200);
  });

  it('admin can hide, restore (not re-hidden by flags) and delete', async () => {
    const a = await newToken();
    const id = ((await (await call('POST', 'create', { token: a, ip: '8.8.8.1', body: report({ title: 'Moderation target', lat: 30.1, lng: 70.1 }) })).json()) as any).id;
    const visible = async () => ((await (await call('GET', 'list')).json()) as any).incidents.some((i: any) => i.id === id);
    expect(await visible()).toBe(true);
    expect((await adminCall('POST', 'admin_set', 'admin-key-for-tests', { id, action: 'hide' })).status).toBe(200);
    expect(await visible()).toBe(false);
    expect((await adminCall('POST', 'admin_set', 'admin-key-for-tests', { id, action: 'restore' })).status).toBe(200);
    expect(await visible()).toBe(true);
    for (let i = 0; i < 3; i++) await call('POST', 'act', { token: await newToken(), ip: `8.8.8.${10 + i}`, body: { id, action: 'flag' } });
    expect(await visible()).toBe(true); // reviewed reports survive flag-bombing
    const list = (await (await adminCall('GET', 'admin_list', 'admin-key-for-tests')).json()) as any;
    expect(list.incidents.find((i: any) => i.id === id)).toMatchObject({ flags: 3, hidden: false, reviewed: true });
    expect((await adminCall('POST', 'admin_set', 'admin-key-for-tests', { id, action: 'delete' })).status).toBe(200);
    expect((await adminCall('POST', 'admin_set', 'admin-key-for-tests', { id, action: 'delete' })).status).toBe(404);
    expect((await adminCall('POST', 'admin_set', 'admin-key-for-tests', { id: 'nope', action: 'hide' })).status).toBe(400);
  });

  it('unreviewed reports are still hidden by three flags', async () => {
    const a = await newToken();
    const id = ((await (await call('POST', 'create', { token: a, ip: '8.8.8.2', body: report({ title: 'Flag target', lat: 30.2, lng: 70.2 }) })).json()) as any).id;
    for (let i = 0; i < 3; i++) await call('POST', 'act', { token: await newToken(), ip: `8.8.9.${i}`, body: { id, action: 'flag' } });
    expect(((await (await call('GET', 'list')).json()) as any).incidents.some((i: any) => i.id === id)).toBe(false);
  });

  it('stores client errors (truncated, validated, IP-limited) and shows them to the admin', async () => {
    const ok = await call('POST', 'log', { ip: '7.7.7.7', body: { kind: 'error', message: 'x'.repeat(900), stack: 's'.repeat(5000), url: 'https://x.test/', release: 'abc' } });
    expect(ok.status).toBe(202);
    expect((await call('POST', 'log', { body: { kind: 'bogus', message: 'm' } })).status).toBe(400);
    expect((await call('POST', 'log', { body: { kind: 'error' } })).status).toBe(400);
    const errs = ((await (await adminCall('GET', 'admin_list', 'admin-key-for-tests')).json()) as any).errors;
    expect(errs[0].message).toHaveLength(500);
    expect(errs[0].stack).toHaveLength(2000);
    let last = 0;
    for (let i = 0; i < 61; i++) last = (await call('POST', 'log', { ip: '7.7.7.8', body: { kind: 'error', message: 'spam' } })).status;
    expect(last).toBe(429);
  });

  it('purge removes long-expired reports', async () => {
    await pg.exec(`insert into incidents (created_by, ip_hash, category, title, lat, lng) values ('00000000-0000-4000-8000-0000000000aa','h','hazard','old one',31,74)`);
    await pg.exec(`update incidents set expires_at = now() - interval '8 days' where title = 'old one'`);
    const r = (await (await adminCall('POST', 'admin_purge', 'admin-key-for-tests')).json()) as any;
    expect(r.incidents).toBeGreaterThanOrEqual(1);
  });
});

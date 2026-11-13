import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { createApi, signToken, verifyToken, validateNewIncident } from './index';

const SECRET = 'test-secret';
const migration = readFileSync(new URL('../db/migrations/001_incidents.sql', import.meta.url), 'utf8');
let pg: PGlite;
let api: ReturnType<typeof createApi>;
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
  api = createApi({ db: async (t, p) => (await pg.query(t, p as any[])).rows, secret: SECRET, now: () => clock });
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
    for (let i = 0; i < 10; i++) expect((await call('POST', 'create', { token: t, ip: '9.9.9.9', body: report({ title: `spam ${i} abc` }) })).status).toBe(201);
    expect((await call('POST', 'create', { token: t, ip: '9.9.9.9', body: report({ title: 'spam 11 abc' }) })).status).toBe(429);
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

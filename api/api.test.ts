import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { createApi, signToken, verifyToken, validateNewIncident, validateTransitReport } from './index';

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
    expect((await call('POST', 'log', { ip: '7.7.7.9', body: { kind: 'flutter', platform: 'android', message: 'StateError', release: '1.0.0+1' } })).status).toBe(202);
    expect((await call('POST', 'log', { body: { kind: 'caught', platform: 'windows', message: 'm' } })).status).toBe(400);
    const errs = ((await (await adminCall('GET', 'admin_list', 'admin-key-for-tests')).json()) as any).errors;
    expect(errs.find((e: any) => e.platform === 'android')?.kind).toBe('flutter');
    expect(errs.find((e: any) => e.release === 'abc')?.platform).toBe('web');
    const web = errs.find((e: any) => e.release === 'abc');
    expect(web.message).toHaveLength(500);
    expect(web.stack).toHaveLength(2000);
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

describe('transit reports', () => {
  const tr = (over: Record<string, unknown> = {}) => ({ city: 'lahore', kind: 'fare', mode: 'rickshaw', value: 400, ...over });
  const stats = async (city = 'lahore') => ((await (await call('GET', `transit_stats&city=${city}`)).json()) as any).stats as any[];

  it('validates city, kind, mode and value ranges per kind', () => {
    expect(validateTransitReport(tr()).ok).toBe(true);
    for (const bad of [{ city: 'paris' }, { kind: 'x' }, { mode: 'rocket' }, { value: 0 }, { value: 1.5 }, { value: 20001 }, { kind: 'delay', value: 241 }, { value: '400' }]) {
      expect(validateTransitReport(tr(bad)).ok).toBe(false);
    }
    expect(validateTransitReport(null).ok).toBe(false);
  });
  it('needs a token, rejects bad bodies, and the database rejects out-of-range values too', async () => {
    expect((await call('POST', 'transit_report', { body: tr() })).status).toBe(401);
    const a = await newToken();
    expect((await call('POST', 'transit_report', { token: a, body: tr({ value: -5 }) })).status).toBe(400);
    await expect(pg.query(`insert into transit_reports (created_by, ip_hash, city, kind, mode, value) values (gen_random_uuid(), 'x', 'lahore', 'delay', 'metrobus', 999)`)).rejects.toThrow();
  });
  it('a device cannot repeat the same report within 10 minutes', async () => {
    const a = await newToken();
    expect((await call('POST', 'transit_report', { token: a, body: tr({ city: 'multan', mode: 'van' }) })).status).toBe(201);
    expect((await call('POST', 'transit_report', { token: a, body: tr({ city: 'multan', mode: 'van', value: 90 }) })).status).toBe(409);
    expect((await call('POST', 'transit_report', { token: a, body: tr({ city: 'multan', mode: 'bus' }) })).status).toBe(201); // different mode is fine
  });
  it('shows no statistics until 5 reports from at least 3 devices, then medians and quartiles', async () => {
    const one = await newToken();
    for (const v of [100, 100, 100, 100, 100]) await pg.query(`insert into transit_reports (created_by, ip_hash, city, kind, mode, value) values ($1,'h','karachi','fare','taxi',$2)`, [(verifyToken(one, SECRET, clock) as string), v]).catch(() => {});
    expect(await stats('karachi')).toEqual([]); // trigger allows 1 per 10 min per device; and one device is never enough anyway
    for (const v of [300, 400, 500, 600, 700]) {
      const t = await newToken();
      expect((await call('POST', 'transit_report', { token: t, ip: `9.9.9.${v / 100}`, body: tr({ city: 'karachi', mode: 'rickshaw', value: v }) })).status).toBe(201);
    }
    const s = (await stats('karachi')).find((x) => x.mode === 'rickshaw')!;
    expect(s).toMatchObject({ kind: 'fare', n: 5, devices: 5, median: 500, p25: 400, p75: 600 });
  });
  it('rejects an unknown city on the stats endpoint', async () => {
    expect((await call('GET', 'transit_stats&city=atlantis')).status).toBe(400);
  });
});

describe('geocode (Geoapify proxy)', () => {
  const sample = { results: [
    { lat: 31.511, lon: 74.343, name: 'Liberty Market', address_line2: 'Gulberg III, Lahore, Pakistan', place_id: 'abc' },
    { lat: 51.5, lon: -0.1, name: 'London Liberty' }, // outside Pakistan: dropped
    { lat: 31.4, lon: 74.2, address_line1: 'Main Boulevard', formatted: 'Main Boulevard, Lahore, Pakistan' },
    { lat: 'x', lon: 74, name: 'Broken' }
  ] };
  const make = (status: number, body: unknown, seen: string[] = []) => createApi({
    db: async () => [], secret: SECRET, geoapifyKey: 'k-test',
    fetchFn: (async (url: string) => { seen.push(String(url)); return new Response(JSON.stringify(body), { status }); }) as any
  });
  const get = (a: ReturnType<typeof createApi>, qs: string) => a.handle(new Request(`https://x.test/api?op=geocode&${qs}`));

  it('is off (404) without a key, so clients fall back to Nominatim', async () => {
    expect((await get(api, 'q=liberty')).status).toBe(404);
  });
  it('maps results, keeps Pakistan only, biases near a rounded point and is cacheable', async () => {
    const seen: string[] = [];
    const r = await get(make(200, sample, seen), 'q=liberty%20market&near=31.5204,74.3587&lang=ur');
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toContain('s-maxage');
    const body: any = await r.json();
    expect(body.results).toEqual([
      { id: 'ga_abc', name: 'Liberty Market', detail: 'Gulberg III, Lahore', lat: 31.511, lng: 74.343 },
      { id: 'ga_31.4,74.2', name: 'Main Boulevard', detail: 'Main Boulevard, Lahore', lat: 31.4, lng: 74.2 }
    ]);
    const u = new URL(seen[0]);
    expect(u.searchParams.get('filter')).toBe('countrycode:pk');
    expect(u.searchParams.get('bias')).toBe('proximity:74.4,31.5');
    expect(u.searchParams.get('lang')).toBe('ur');
  });
  it('ignores a bias point outside Pakistan and rejects bad queries', async () => {
    const seen: string[] = [];
    await get(make(200, sample, seen), 'q=derby&near=52.9,-1.47');
    expect(new URL(seen[0]).searchParams.get('bias')).toBeNull();
    expect((await get(make(200, sample), 'q=a')).status).toBe(400);
  });
  it('reports upstream failures without leaking the key', async () => {
    const r = await get(make(500, {}), 'q=liberty');
    expect(r.status).toBe(502);
    expect(await r.text()).not.toContain('k-test');
    expect((await get(make(429, {}), 'q=liberty')).status).toBe(429);
  });
});

describe('nearby (Geoapify Places)', () => {
  const feats = { features: [
    { properties: { lat: 30.2, lon: 71.47, name: 'Nishtar Hospital', address_line2: 'Nishtar Road, Multan, Pakistan', place_id: 'p1',
      datasource: { raw: { osm_type: 'w', osm_id: 42, 'name:ur': 'نشتر ہسپتال', phone: '+92 61 9200231', emergency: 'yes', opening_hours: '24/7' } } } },
    { properties: { lat: 30.21, lon: 71.48, place_id: 'p2', datasource: { raw: {} } } }, // no name: dropped
    { properties: { lat: 30.22, lon: 71.49, name: 'City Clinic', place_id: 'p3' } }
  ] };
  const make = (seen: string[] = []) => createApi({ db: async () => [], secret: SECRET, geoapifyKey: 'k',
    fetchFn: (async (url: string) => { seen.push(String(url)); return new Response(JSON.stringify(feats)); }) as any });
  const get = (a: ReturnType<typeof createApi>, qs: string) => a.handle(new Request(`https://x.test/api?op=nearby&${qs}`));

  it('maps OSM tags without guessing and rounds the point to ~1 km', async () => {
    const seen: string[] = [];
    const r = await get(make(seen), 'kind=hospital&near=30.1984,71.4687');
    expect(r.status).toBe(200);
    const { items }: any = await r.json();
    expect(items).toEqual([
      { id: 'osm_way_42', kind: 'hospital', name: 'Nishtar Hospital', nameUrdu: 'نشتر ہسپتال', lat: 30.2, lng: 71.47, address: 'Nishtar Road, Multan', phone: '+92 61 9200231', open24h: true, emergency: true },
      { id: 'ga_p3', kind: 'hospital', name: 'City Clinic', nameUrdu: null, lat: 30.22, lng: 71.49, address: null, phone: null, open24h: null, emergency: null }
    ]);
    const u = new URL(seen[0]);
    expect(u.searchParams.get('categories')).toBe('healthcare.hospital');
    expect(u.searchParams.get('filter')).toBe('circle:71.47,30.2,50000');
  });
  it('rejects bad input and is off without a key', async () => {
    expect((await get(make(), 'kind=bank&near=30,71')).status).toBe(400);
    expect((await get(make(), 'kind=fuel&near=52.9,-1.47')).status).toBe(400);
    expect((await get(make(), 'kind=fuel')).status).toBe(400);
    expect((await get(api, 'kind=fuel&near=30,71')).status).toBe(404);
  });
});

/**
 * Buraq Pakistan incident API (Vercel Function, Neon Postgres).
 *
 *   POST /api?op=session            -> { token }                       mint an anonymous device token
 *   GET  /api?op=list               -> { incidents: [...] }            active, non-hidden reports
 *   POST /api?op=create             body: incident fields              report an incident        (token)
 *   POST /api?op=act                body: { id, action }               action = confirm | flag   (token)
 *   POST /api?op=transit_report     body: { city, kind, mode, value }  fare (PKR) or delay (min)  (token)
 *   GET  /api?op=transit_stats&city= -> { stats: [...] }               median/quartiles, only with >=5 reports from >=3 devices
 *   POST /api?op=log                body: { kind, message, ... }       client error report       (IP-limited)
 *   GET  /api?op=admin_list         -> reports (incl. hidden) + errors (Authorization: Bearer ADMIN_KEY)
 *   POST /api?op=admin_set          body: { id, action }               hide | restore | delete   (ADMIN_KEY)
 *   POST /api?op=admin_purge        -> deletes expired reports (>7 d) and old errors (>14 d)  (ADMIN_KEY)
 *   Admin operations answer 404 until the ADMIN_KEY environment variable is set.
 *
 * Everything lives in this one file on purpose: it has no relative imports, so it deploys identically
 * on any Vercel Node runtime. All logic takes an injected `db`, so tests run it against a real Postgres (PGlite).
 */
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export type Db = (text: string, params?: unknown[]) => Promise<any[]>;
export interface ApiDeps {
  db: Db;
  secret: Buffer | string;
  now?: () => number;
  /** Enables the admin operations. Unset = admin disabled (404). */
  adminKey?: string;
  /** Geoapify key for place search (`op=geocode`). Unset = geocode answers 404 and clients use Nominatim. */
  geoapifyKey?: string;
  fetchFn?: typeof fetch;
}

/** Pakistan bounding box, also used by the database for reports. */
const PK_BOX = { minLat: 23.5, maxLat: 37.2, minLng: 60.8, maxLng: 77.9 };

/** Geoapify result -> the small shape both clients use. Names come from OSM data; nothing is guessed. */
export function mapGeoapify(body: any): { id: string; name: string; detail: string; lat: number; lng: number }[] {
  const list = Array.isArray(body?.results) ? body.results : [];
  const out: { id: string; name: string; detail: string; lat: number; lng: number }[] = [];
  for (const r of list) {
    const lat = Number(r?.lat), lng = Number(r?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < PK_BOX.minLat || lat > PK_BOX.maxLat || lng < PK_BOX.minLng || lng > PK_BOX.maxLng) continue;
    const name = String(r?.name || r?.address_line1 || '').trim();
    if (!name) continue;
    const detail = String(r?.address_line2 || r?.formatted || '').replace(/,?\s*Pakistan$/i, '').trim();
    out.push({ id: `ga_${String(r?.place_id || `${lat},${lng}`).slice(0, 80)}`, name: name.slice(0, 120), detail: detail.slice(0, 200), lat, lng });
  }
  return out;
}

const CATEGORIES = ['accident', 'congestion', 'closure', 'construction', 'flooding', 'roadblock', 'police_naka', 'hazard'];
export const TRANSIT_CITIES = ['lahore', 'karachi', 'islamabad', 'rawalpindi', 'multan', 'faisalabad'];
export const TRANSIT_MODES = ['metrobus', 'orange_line', 'bus', 'van', 'rickshaw', 'taxi', 'ride_hail'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_TTL_MS = 90 * 24 * 3600 * 1000;
const MAX_BODY_BYTES = 8 * 1024;

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
const fail = (status: number, error: string) => json(status, { error });

// ------------------------------------------------------------------ tokens (stateless, HMAC-SHA256)
const b64 = (b: Buffer) => b.toString('base64url');
const mac = (secret: Buffer | string, data: string) => createHmac('sha256', secret).update(data).digest();

export function signToken(deviceId: string, secret: Buffer | string, now: number): string {
  const payload = b64(Buffer.from(JSON.stringify({ d: deviceId, e: now + TOKEN_TTL_MS })));
  return `v1.${payload}.${b64(mac(secret, `v1.${payload}`))}`;
}

export function verifyToken(token: string | null | undefined, secret: Buffer | string, now: number): string | null {
  if (!token) return null;
  const [v, payload, sig] = token.split('.');
  if (v !== 'v1' || !payload || !sig) return null;
  const expected = mac(secret, `v1.${payload}`);
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { d, e } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof d === 'string' && UUID.test(d) && typeof e === 'number' && e > now ? d : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ validation
const str = (v: unknown, max: number): string | null | undefined => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') return undefined; // wrong type
  const t = v.trim();
  return t.length > max ? undefined : t || null;
};

export type NewIncidentInput = {
  category: string; title: string; title_ur: string | null; description: string | null; description_ur: string | null;
  location_name: string | null; advice: string | null; lat: number; lng: number;
  /** Optional shorter lifetime (1-360 min, default 120). The database still caps expiry at 6 h. */
  ttl_minutes: number | null;
};

export function validateNewIncident(b: any): { ok: true; value: NewIncidentInput } | { ok: false; error: string } {
  if (!b || typeof b !== 'object') return { ok: false, error: 'invalid_body' };
  if (!CATEGORIES.includes(b.category)) return { ok: false, error: 'invalid_category' };
  const title = str(b.title, 120);
  if (!title || title.length < 3) return { ok: false, error: 'invalid_title' };
  const fields = { title_ur: str(b.title_ur, 120), description: str(b.description, 500), description_ur: str(b.description_ur, 500), location_name: str(b.location_name, 160), advice: str(b.advice, 300) };
  for (const [k, v] of Object.entries(fields)) if (v === undefined) return { ok: false, error: `invalid_${k}` };
  const { lat, lng } = b;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !(lat >= 23 && lat <= 37.5) || !(lng >= 60 && lng <= 77.9)) {
    return { ok: false, error: 'invalid_location' };
  }
  let ttl_minutes: number | null = null;
  if (b.ttl_minutes !== undefined && b.ttl_minutes !== null) {
    if (!Number.isInteger(b.ttl_minutes) || b.ttl_minutes < 1 || b.ttl_minutes > 360) return { ok: false, error: 'invalid_ttl' };
    ttl_minutes = b.ttl_minutes;
  }
  return { ok: true, value: { category: b.category, title, ...(fields as Omit<NewIncidentInput, 'category' | 'title' | 'lat' | 'lng' | 'ttl_minutes'>), lat, lng, ttl_minutes } };
}

export type TransitReportInput = { city: string; kind: 'fare' | 'delay'; mode: string; value: number };

export function validateTransitReport(b: any): { ok: true; value: TransitReportInput } | { ok: false; error: string } {
  if (!b || typeof b !== 'object') return { ok: false, error: 'invalid_body' };
  if (!TRANSIT_CITIES.includes(b.city)) return { ok: false, error: 'invalid_city' };
  if (b.kind !== 'fare' && b.kind !== 'delay') return { ok: false, error: 'invalid_kind' };
  if (!TRANSIT_MODES.includes(b.mode)) return { ok: false, error: 'invalid_mode' };
  const max = b.kind === 'fare' ? 20000 : 240;
  if (!Number.isInteger(b.value) || b.value < 1 || b.value > max) return { ok: false, error: 'invalid_value' };
  return { ok: true, value: { city: b.city, kind: b.kind, mode: b.mode, value: b.value } };
}

// ------------------------------------------------------------------ handlers
/** Geoapify Places (GeoJSON) -> the bundled-POI shape. OSM tags come from datasource.raw; unknown stays null. */
export function mapPlaces(body: any, kind: string) {
  const feats = Array.isArray(body?.features) ? body.features : [];
  const out: any[] = [];
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null);
  for (const f of feats) {
    const p = f?.properties ?? {};
    const t = p?.datasource?.raw ?? {};
    const lat = Number(p.lat), lng = Number(p.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < PK_BOX.minLat || lat > PK_BOX.maxLat || lng < PK_BOX.minLng || lng > PK_BOX.maxLng) continue;
    const name = str(t['name:en']) ?? str(p.name) ?? str(t.name) ?? str(t.brand) ?? str(t.operator);
    if (!name) continue;
    const osm = t.osm_type && t.osm_id ? `${t.osm_type === 'n' ? 'node' : t.osm_type === 'w' ? 'way' : t.osm_type === 'r' ? 'relation' : t.osm_type}/${t.osm_id}` : null;
    out.push({
      id: osm ? `osm_${osm.replace('/', '_')}` : `ga_${String(p.place_id ?? `${lat},${lng}`).slice(0, 80)}`,
      kind, name, nameUrdu: str(t['name:ur']), lat, lng,
      address: str(p.address_line2)?.replace(/,?\s*Pakistan$/i, '') ?? null,
      phone: str(t.phone) ?? str(t['contact:phone']),
      open24h: t.opening_hours === '24/7' ? true : null,
      emergency: t.emergency === 'yes' ? true : null
    });
  }
  return out;
}

export function createApi({ db, secret, now = Date.now, adminKey, geoapifyKey, fetchFn = fetch }: ApiDeps) {
  const ipHashOf = (req: Request) => {
    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
    return createHash('sha256').update(`ip:${ip}`).update(secret).digest('hex').slice(0, 32);
  };
  const deviceOf = (req: Request) => verifyToken((req.headers.get('authorization') || '').replace(/^Bearer /i, ''), secret, now());

  async function readJson(req: Request): Promise<any | null> {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return null;
    try { return JSON.parse(text); } catch { return null; }
  }

  const dbError = (e: any) => {
    const msg = String(e?.message ?? '');
    if (msg.includes('rate_limit')) return fail(429, 'rate_limited');
    if (msg.includes('own_report')) return fail(403, 'own_report');
    if (msg.includes('duplicate_report')) return fail(409, 'duplicate_report');
    if (e?.code === '23503') return fail(404, 'not_found');
    if (e?.code === '23505') return json(200, { ok: true, duplicate: true });
    console.error('db error', e);
    return fail(500, 'server_error');
  };

  return {
    async session() {
      return json(200, { token: signToken(randomUUID(), secret, now()) });
    },

    async list(req: Request) {
      const device = deviceOf(req);
      try {
        const rows = await db(
          `select i.id, i.category, i.title, i.title_ur, i.description, i.description_ur, i.location_name, i.advice,
                  i.lat, i.lng, i.created_at, i.expires_at, i.confirmations,
                  ($1::uuid is not null and i.created_by = $1::uuid) as mine,
                  exists (select 1 from incident_confirmations c where c.incident_id = i.id and c.device_id = $1::uuid) as confirmed
             from incidents i
            where not i.hidden and i.expires_at > now()
            order by i.created_at desc limit 200`,
          [device]
        );
        return json(200, { incidents: rows });
      } catch (e) {
        return dbError(e);
      }
    },

    async create(req: Request) {
      const device = deviceOf(req);
      if (!device) return fail(401, 'unauthorized');
      const body = await readJson(req);
      const v = validateNewIncident(body);
      if (!v.ok) return fail(400, v.error);
      const x = v.value;
      try {
        const rows = await db(
          `insert into incidents (created_by, ip_hash, category, title, title_ur, description, description_ur, location_name, advice, lat, lng, expires_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now() + make_interval(mins => coalesce($12::int, 120))) returning id`,
          [device, ipHashOf(req), x.category, x.title, x.title_ur, x.description, x.description_ur, x.location_name, x.advice, x.lat, x.lng, x.ttl_minutes]
        );
        return json(201, { id: rows[0].id });
      } catch (e) {
        return dbError(e);
      }
    },

    async act(req: Request) {
      const device = deviceOf(req);
      if (!device) return fail(401, 'unauthorized');
      const body = await readJson(req);
      if (!body || typeof body.id !== 'string' || !UUID.test(body.id) || !['confirm', 'flag'].includes(body.action)) return fail(400, 'invalid_body');
      const table = body.action === 'confirm' ? 'incident_confirmations' : 'incident_flags';
      try {
        await db(`insert into ${table} (incident_id, device_id, ip_hash) values ($1,$2,$3)`, [body.id, device, ipHashOf(req)]);
        return json(200, { ok: true });
      } catch (e) {
        return dbError(e);
      }
    },

    async transitReport(req: Request) {
      const device = deviceOf(req);
      if (!device) return fail(401, 'unauthorized');
      const v = validateTransitReport(await readJson(req));
      if (!v.ok) return fail(400, v.error);
      try {
        await db('insert into transit_reports (created_by, ip_hash, city, kind, mode, value) values ($1,$2,$3,$4,$5,$6)',
          [device, ipHashOf(req), v.value.city, v.value.kind, v.value.mode, v.value.value]);
        return json(201, { ok: true });
      } catch (e) {
        return dbError(e);
      }
    },

    /** Medians over a window (fares 60 days, delays 3 hours). A group is only shown with >=5 reports from >=3 devices. */
    async transitStats(req: Request) {
      const city = new URL(req.url).searchParams.get('city') ?? '';
      if (!TRANSIT_CITIES.includes(city)) return fail(400, 'invalid_city');
      try {
        const rows = await db(
          `select kind, mode, count(*)::int as n, count(distinct created_by)::int as devices,
                  percentile_cont(0.5) within group (order by value)  as median,
                  percentile_cont(0.25) within group (order by value) as p25,
                  percentile_cont(0.75) within group (order by value) as p75
             from transit_reports
            where city = $1 and created_at > now() - (case when kind = 'delay' then interval '3 hours' else interval '60 days' end)
            group by kind, mode
           having count(*) >= 5 and count(distinct created_by) >= 3
            order by kind, mode`,
          [city]
        );
        return json(200, { stats: rows.map((r) => ({ kind: r.kind, mode: r.mode, n: r.n, devices: r.devices, median: Math.round(Number(r.median)), p25: Math.round(Number(r.p25)), p75: Math.round(Number(r.p75)) })) });
      } catch (e) {
        return dbError(e);
      }
    },

    async log(req: Request) {
      const b = await readJson(req);
      if (!b || typeof b !== 'object') return fail(400, 'invalid_body');
      const cut = (v: unknown, n: number) => (typeof v === 'string' && v ? v.slice(0, n) : null);
      const message = cut(b.message, 500);
      if (!message || !['error', 'unhandledrejection', 'react', 'flutter', 'caught'].includes(b.kind)) return fail(400, 'invalid_body');
      const platform = b.platform === undefined ? 'web' : b.platform;
      if (!['web', 'android', 'ios'].includes(platform)) return fail(400, 'invalid_body');
      try {
        await db(
          `insert into client_errors (ip_hash, kind, message, stack, url, user_agent, release, platform) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [ipHashOf(req), b.kind, message, cut(b.stack, 2000), cut(b.url, 300), cut(req.headers.get('user-agent'), 300), cut(b.release, 40), platform]
        );
        return json(202, { ok: true });
      } catch (e) {
        return dbError(e);
      }
    },

    // ---- admin (ADMIN_KEY bearer; constant-time compare)
    isAdmin(req: Request) {
      if (!adminKey) return false;
      const given = (req.headers.get('authorization') || '').replace(/^Bearer /i, '');
      const a = createHash('sha256').update(given).digest();
      const b = createHash('sha256').update(adminKey).digest();
      return timingSafeEqual(a, b);
    },

    async adminList() {
      try {
        const incidents = await db(
          `select id, category, title, description, location_name, lat, lng, created_at, expires_at, confirmations, flags, hidden, reviewed,
                  left(created_by::text, 8) as device
             from incidents where created_at > now() - interval '7 days' order by created_at desc limit 300`
        );
        const errors = await db(`select id, created_at, kind, platform, message, stack, url, user_agent, release from client_errors order by created_at desc limit 100`);
        return json(200, { incidents, errors });
      } catch (e) {
        return dbError(e);
      }
    },

    async adminSet(req: Request) {
      const b = await readJson(req);
      if (!b || typeof b.id !== 'string' || !UUID.test(b.id) || !['hide', 'restore', 'delete'].includes(b.action)) return fail(400, 'invalid_body');
      try {
        const rows = b.action === 'delete'
          ? await db('delete from incidents where id = $1 returning id', [b.id])
          : b.action === 'hide'
            ? await db('update incidents set hidden = true where id = $1 returning id', [b.id])
            : await db('update incidents set hidden = false, reviewed = true where id = $1 returning id', [b.id]);
        return rows.length ? json(200, { ok: true }) : fail(404, 'not_found');
      } catch (e) {
        return dbError(e);
      }
    },

    async adminPurge() {
      try {
        const a = await db(`delete from incidents where expires_at < now() - interval '7 days' returning id`);
        const e = await db(`delete from client_errors where created_at < now() - interval '14 days' returning id`);
        const tr = await db(`delete from transit_reports where created_at < now() - interval '120 days' returning id`);
        return json(200, { incidents: a.length, errors: e.length, transitReports: tr.length });
      } catch (e) {
        return dbError(e);
      }
    },

    /** Place search, Pakistan only. The key stays on the server and Geoapify sees our server, not the user's IP.
     *  Queries are never logged or stored. Answers are cacheable at the edge (near is rounded to ~10 km). */
    async geocode(req: Request): Promise<Response> {
      if (!geoapifyKey) return fail(404, 'geocode_disabled');
      const u = new URL(req.url);
      const q = (u.searchParams.get('q') || '').trim();
      if (q.length < 2 || q.length > 120) return fail(400, 'bad_query');
      const lang = u.searchParams.get('lang') === 'ur' ? 'ur' : 'en';
      const params = new URLSearchParams({ text: q, filter: 'countrycode:pk', lang, limit: '6', format: 'json', apiKey: geoapifyKey });
      const near = (u.searchParams.get('near') || '').split(',').map(Number);
      if (near.length === 2 && near.every(Number.isFinite)) {
        const [lat, lng] = near.map((v) => Math.round(v * 10) / 10);
        if (lat >= PK_BOX.minLat && lat <= PK_BOX.maxLat && lng >= PK_BOX.minLng && lng <= PK_BOX.maxLng) params.set('bias', `proximity:${lng},${lat}`);
      }
      try {
        const r = await fetchFn(`https://api.geoapify.com/v1/geocode/search?${params}`, { signal: AbortSignal.timeout(6000) });
        if (!r.ok) {
          console.error('geocode upstream', r.status); // status only: never the query
          return fail(r.status === 429 ? 429 : 502, r.status === 429 ? 'rate_limited' : 'upstream_error');
        }
        return json(200, { results: mapGeoapify(await r.json()) }, { 'cache-control': 'public, max-age=300, s-maxage=86400' });
      } catch (e: any) {
        console.error('geocode upstream', e?.name || 'error');
        return fail(502, 'upstream_error');
      }
    },

    /** Nearest hospitals / fuel stations anywhere in Pakistan (Geoapify Places, which serves OpenStreetMap data).
     *  `near` is rounded to ~1 km; nothing is logged or stored. Same field meanings as the bundled OSM extract. */
    async nearby(req: Request): Promise<Response> {
      if (!geoapifyKey) return fail(404, 'nearby_disabled');
      const u = new URL(req.url);
      const kind = u.searchParams.get('kind');
      const category = kind === 'hospital' ? 'healthcare.hospital' : kind === 'fuel' ? 'service.vehicle.fuel' : null;
      if (!category) return fail(400, 'bad_kind');
      const near = (u.searchParams.get('near') || '').split(',').map(Number);
      if (near.length !== 2 || !near.every(Number.isFinite)) return fail(400, 'bad_near');
      const [lat, lng] = near.map((v) => Math.round(v * 100) / 100);
      if (lat < PK_BOX.minLat || lat > PK_BOX.maxLat || lng < PK_BOX.minLng || lng > PK_BOX.maxLng) return fail(400, 'outside_pakistan');
      const params = new URLSearchParams({ categories: category, filter: `circle:${lng},${lat},50000`, bias: `proximity:${lng},${lat}`, limit: '30', apiKey: geoapifyKey });
      try {
        const r = await fetchFn(`https://api.geoapify.com/v2/places?${params}`, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) {
          console.error('nearby upstream', r.status);
          return fail(r.status === 429 ? 429 : 502, r.status === 429 ? 'rate_limited' : 'upstream_error');
        }
        return json(200, { items: mapPlaces(await r.json(), kind!) }, { 'cache-control': 'public, max-age=600, s-maxage=604800' });
      } catch (e: any) {
        console.error('nearby upstream', e?.name || 'error');
        return fail(502, 'upstream_error');
      }
    },

    async handle(req: Request): Promise<Response> {
      const op = new URL(req.url).searchParams.get('op');
      if (req.method === 'POST' && op === 'session') return this.session();
      if (req.method === 'GET' && op === 'list') return this.list(req);
      if (req.method === 'POST' && op === 'create') return this.create(req);
      if (req.method === 'POST' && op === 'act') return this.act(req);
      if (req.method === 'POST' && op === 'log') return this.log(req);
      if (req.method === 'POST' && op === 'transit_report') return this.transitReport(req);
      if (req.method === 'GET' && op === 'transit_stats') return this.transitStats(req);
      if (req.method === 'GET' && op === 'geocode') return this.geocode(req);
      if (req.method === 'GET' && op === 'nearby') return this.nearby(req);
      if (op?.startsWith('admin_')) {
        if (!adminKey) return fail(404, 'unknown_op');
        if (!this.isAdmin(req)) return fail(401, 'unauthorized');
        if (req.method === 'GET' && op === 'admin_list') return this.adminList();
        if (req.method === 'POST' && op === 'admin_set') return this.adminSet(req);
        if ((req.method === 'POST' || req.method === 'GET') && op === 'admin_purge') return this.adminPurge(); // GET: Vercel Cron
      }
      return fail(op ? 405 : 404, op ? 'method_not_allowed' : 'unknown_op');
    }
  };
}

// ------------------------------------------------------------------ Vercel wiring (not exercised by unit tests)
let cached: ReturnType<typeof createApi> | null = null;
async function runtime() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url);
  // Session secret: explicit SESSION_SECRET, else derived from the database URL (itself a secret, rotates with it)
  const secret = process.env.SESSION_SECRET || createHash('sha256').update(`buraq-session-v1:${url}`).digest();
  cached = createApi({ db: async (text, params) => (await sql.query(text, params as any[])) as any[], secret, adminKey: process.env.ADMIN_KEY || undefined, geoapifyKey: process.env.GEOAPIFY_KEY || undefined });
  return cached;
}

async function dispatch(req: Request): Promise<Response> {
  try {
    return await (await runtime()).handle(req);
  } catch (e) {
    console.error('api unavailable', e);
    return fail(503, 'backend_unavailable');
  }
}

export const GET = dispatch;
export const POST = dispatch;

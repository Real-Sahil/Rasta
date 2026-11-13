/**
 * Buraq Pakistan incident API (Vercel Function, Neon Postgres).
 *
 *   POST /api?op=session            -> { token }                       mint an anonymous device token
 *   GET  /api?op=list               -> { incidents: [...] }            active, non-hidden reports
 *   POST /api?op=create             body: incident fields              report an incident        (token)
 *   POST /api?op=act                body: { id, action }               action = confirm | flag   (token)
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
}

const CATEGORIES = ['accident', 'congestion', 'closure', 'construction', 'flooding', 'roadblock', 'police_naka', 'hazard'];
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
  return { ok: true, value: { category: b.category, title, ...(fields as Omit<NewIncidentInput, 'category' | 'title' | 'lat' | 'lng'>), lat, lng } };
}

// ------------------------------------------------------------------ handlers
export function createApi({ db, secret, now = Date.now }: ApiDeps) {
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
          `insert into incidents (created_by, ip_hash, category, title, title_ur, description, description_ur, location_name, advice, lat, lng)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
          [device, ipHashOf(req), x.category, x.title, x.title_ur, x.description, x.description_ur, x.location_name, x.advice, x.lat, x.lng]
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

    async handle(req: Request): Promise<Response> {
      const op = new URL(req.url).searchParams.get('op');
      if (req.method === 'POST' && op === 'session') return this.session();
      if (req.method === 'GET' && op === 'list') return this.list(req);
      if (req.method === 'POST' && op === 'create') return this.create(req);
      if (req.method === 'POST' && op === 'act') return this.act(req);
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
  cached = createApi({ db: async (text, params) => (await sql.query(text, params as any[])) as any[], secret });
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

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { CommunityIncident, IncidentCategory } from '../types';

/** Row shape returned by `GET /api?op=list` (see api/index.ts). */
export interface IncidentRow {
  id: string;
  category: IncidentCategory;
  title: string;
  title_ur: string | null;
  description: string | null;
  description_ur: string | null;
  location_name: string | null;
  advice: string | null;
  lat: number;
  lng: number;
  created_at: string;
  expires_at: string;
  confirmations: number;
  mine: boolean;
  confirmed: boolean;
}

/** Credibility is derived from independent confirmations, never invented: 50% base, +5 per confirmation, capped at 95. */
export const credibilityFor = (confirmations: number) => Math.min(95, 50 + 5 * Math.max(0, confirmations));

export function rowToIncident(row: IncidentRow): CommunityIncident {
  return {
    id: row.id,
    title: row.title,
    titleUrdu: row.title_ur || row.title,
    category: row.category,
    locationName: row.location_name || 'Reported location',
    locationNameUrdu: row.location_name || 'رپورٹ کردہ مقام',
    lat: row.lat,
    lng: row.lng,
    description: row.description || '',
    descriptionUrdu: row.description_ur || row.description || '',
    timestamp: new Date(row.created_at).getTime(),
    upvotes: row.confirmations,
    userConfirmed: row.confirmed || row.mine,
    credibilityScore: credibilityFor(row.confirmations),
    isOfficialVerified: false,
    source: 'Citizen_Report',
    alternativeRouteAdvice: row.advice || undefined,
    alternativeRouteAdviceUrdu: row.advice || undefined,
    expiresAt: new Date(row.expires_at).getTime()
  };
}

export type NewIncident = Pick<CommunityIncident, 'category' | 'title' | 'titleUrdu' | 'description' | 'descriptionUrdu' | 'locationName' | 'lat' | 'lng'> & {
  alternativeRouteAdvice?: string;
};

export function incidentToBody(i: NewIncident) {
  const t = i.title.trim();
  const d = (i.description ?? '').trim();
  return {
    category: i.category,
    title: t,
    title_ur: i.titleUrdu && i.titleUrdu.trim() !== t ? i.titleUrdu.trim() : null,
    description: d || null,
    description_ur: i.descriptionUrdu && i.descriptionUrdu.trim() !== d ? i.descriptionUrdu.trim() : null,
    location_name: i.locationName?.trim() || null,
    advice: i.alternativeRouteAdvice?.trim() || null,
    lat: i.lat,
    lng: i.lng
  };
}

// ---------------------------------------------------------------- transport
const TOKEN_KEY = 'buraq_device_token_v1';
const readToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const writeToken = (t: string | null) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } };

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

async function request(op: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<any> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  const token = init.auth === false ? null : readToken();
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`/api?op=${op}`, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
  // In local dev (no serverless function) the dev server answers with the HTML shell: treat as "no backend"
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) throw new ApiError(res.status, 'no_backend');
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'error');
  return data;
}

/** One anonymous, signed identity per device: enough for ownership, rate limits and one confirmation per person. */
async function authed(op: string, body?: unknown): Promise<any> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!readToken()) writeToken((await request('session', { method: 'POST', auth: false })).token);
    try {
      return await request(op, { method: 'POST', body });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && attempt === 0) { writeToken(null); continue; }
      throw e;
    }
  }
}

export async function fetchActiveIncidents(): Promise<CommunityIncident[]> {
  const data = await request('list');
  return (data.incidents as IncidentRow[]).map(rowToIncident);
}

export const submitIncident = async (i: NewIncident): Promise<void> => void (await authed('create', incidentToBody(i)));
export const confirmIncident = async (id: string): Promise<void> => void (await authed('act', { id, action: 'confirm' }));
export const flagIncident = async (id: string): Promise<void> => void (await authed('act', { id, action: 'flag' }));

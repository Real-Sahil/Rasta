/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CommunityIncident, IncidentCategory } from '../types';

export interface IncidentRow {
  id: string;
  created_by: string;
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
}

/** Credibility is derived from independent confirmations, never invented: 50% base, +5 per confirmation, capped at 95. */
export const credibilityFor = (confirmations: number) => Math.min(95, 50 + 5 * Math.max(0, confirmations));

export function rowToIncident(row: IncidentRow, myConfirmed: ReadonlySet<string>, myId: string | null): CommunityIncident {
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
    userConfirmed: myConfirmed.has(row.id) || row.created_by === myId,
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

export function incidentToInsert(i: NewIncident) {
  return {
    category: i.category,
    title: i.title.trim(),
    title_ur: i.titleUrdu && i.titleUrdu.trim() !== i.title.trim() ? i.titleUrdu.trim() : null,
    description: i.description?.trim() || null,
    description_ur: i.descriptionUrdu && i.descriptionUrdu.trim() !== (i.description ?? '').trim() ? i.descriptionUrdu.trim() : null,
    location_name: i.locationName?.trim() || null,
    advice: i.alternativeRouteAdvice?.trim() || null,
    lat: i.lat,
    lng: i.lng
  };
}

// ---------------------------------------------------------------- client (optional: the app works without a backend)
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isBackendConfigured = (): boolean => Boolean(url && key);

let client: SupabaseClient | null = null;
const sb = (): SupabaseClient => {
  if (!client) client = createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
};

/** One anonymous identity per device: enough for ownership, rate limits and one-confirmation-per-person. */
async function ensureUserId(): Promise<string> {
  const { data } = await sb().auth.getSession();
  if (data.session) return data.session.user.id;
  const res = await sb().auth.signInAnonymously();
  if (res.error || !res.data.user) throw res.error ?? new Error('anonymous sign-in failed');
  return res.data.user.id;
}

export async function fetchActiveIncidents(): Promise<CommunityIncident[]> {
  const myId = await ensureUserId();
  const [inc, mine] = await Promise.all([
    sb().from('incidents').select('*').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(200),
    sb().from('incident_confirmations').select('incident_id')
  ]);
  if (inc.error) throw inc.error;
  const confirmed = new Set<string>((mine.data ?? []).map((r: { incident_id: string }) => r.incident_id));
  return (inc.data as IncidentRow[]).map((r) => rowToIncident(r, confirmed, myId));
}

export async function submitIncident(i: NewIncident): Promise<void> {
  await ensureUserId();
  const { error } = await sb().from('incidents').insert(incidentToInsert(i));
  if (error) throw error;
}

export async function confirmIncident(incidentId: string): Promise<void> {
  await ensureUserId();
  const { error } = await sb().from('incident_confirmations').insert({ incident_id: incidentId });
  if (error && error.code !== '23505') throw error; // already confirmed is fine
}

export async function flagIncident(incidentId: string): Promise<void> {
  await ensureUserId();
  const { error } = await sb().from('incident_flags').insert({ incident_id: incidentId });
  if (error && error.code !== '23505') throw error;
}

/** Calls `onChange` whenever any incident changes. Returns an unsubscribe function. */
export function subscribeIncidents(onChange: () => void): () => void {
  const ch = sb()
    .channel('incidents-feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, onChange)
    .subscribe();
  return () => void sb().removeChannel(ch);
}

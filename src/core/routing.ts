/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { RouteOption, TravelMode } from '../types';
import { LatLng, haversineM } from './geo';
import { osrmStep } from '../services/routeInstructions';

export interface RouteRequest {
  from: LatLng;
  to: LatLng;
  destId: string;
  mode: TravelMode;
}

export interface RouteResult {
  routes: RouteOption[];
  /** 'network' = real road routing; 'estimate' = straight-line fallback with no road data */
  source: 'network' | 'estimate';
}

// The public OSRM demo server only has a car profile; walking uses the FOSSGIS foot server.
function endpoint(mode: TravelMode): string {
  return mode === 'WALKING'
    ? 'https://routing.openstreetmap.de/routed-foot/route/v1/driving'
    : 'https://router.project-osrm.org/route/v1/driving';
}

export function buildOsrmUrl(req: RouteRequest): string {
  const { from, to } = req;
  return `${endpoint(req.mode)}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true&alternatives=true`;
}

/** The two longest named roads of a route, used as its 'via' label. */
export function mainRoads(steps: any[]): string[] {
  const byName = new Map<string, number>();
  for (const st of steps) if (st?.name) byName.set(st.name, (byName.get(st.name) ?? 0) + (st.distance ?? 0));
  return [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n]) => n);
}

/** Validate and convert an OSRM response. Returns [] for anything malformed. */
export function parseOsrmRoutes(data: any, req: RouteRequest): RouteOption[] {
  if (!data || data.code !== 'Ok' || !Array.isArray(data.routes)) return [];
  const out: RouteOption[] = [];
  data.routes.slice(0, 3).forEach((r: any, idx: number) => {
    const coords = r?.geometry?.coordinates;
    const steps = r?.legs?.[0]?.steps;
    if (!Array.isArray(coords) || coords.length < 2 || !Array.isArray(steps) || !Number.isFinite(r.distance)) return;
    const km = Number((r.distance / 1000).toFixed(1));
    const roads = mainRoads(steps);
    out.push({
      id: `osrm_${req.destId}_${req.mode}_${idx}`,
      title: idx === 0 ? 'Recommended route' : `Alternative route ${idx}`,
      titleUrdu: idx === 0 ? 'تجویز کردہ راستہ' : `متبادل راستہ ${idx}`,
      via: roads.length ? roads.join(' & ') : 'Main roads',
      viaUrdu: roads.length ? roads.join(' اور ') : 'مرکزی سڑکیں',
      distanceKm: km,
      durationMinutes: Math.max(1, Math.round(r.duration / 60)),
      hasTolls: false,
      isRecommended: idx === 0,
      steps: steps.map(osrmStep),
      pathCoordinates: coords.map((c: [number, number]) => ({ lat: c[1], lng: c[0] }))
    });
  });
  return out;
}

/** Offline fallback: one clearly-labelled straight-line estimate (no invented streets, tolls or traffic). */
export function estimateRoute(req: RouteRequest): RouteOption {
  const straightKm = haversineM(req.from, req.to) / 1000;
  const factor = req.mode === 'WALKING' ? 1.2 : 1.35;
  const speedKmh = req.mode === 'WALKING' ? 5 : req.mode === 'TWO_WHEELER' ? 25 : 30;
  const km = Math.max(0.1, Number((straightKm * factor).toFixed(1)));
  const minutes = Math.max(1, Math.round((km / speedKmh) * 60));
  const meters = Math.round(km * 1000);
  const path = Array.from({ length: 13 }, (_, i) => ({
    lat: req.from.lat + ((req.to.lat - req.from.lat) * i) / 12,
    lng: req.from.lng + ((req.to.lng - req.from.lng) * i) / 12
  }));
  return {
    id: `local_${req.destId}_${req.mode}`,
    title: 'Estimated route (offline)',
    titleUrdu: 'اندازہً راستہ (آف لائن)',
    via: 'Straight-line estimate, no road data. Connect to the internet for turn-by-turn routing',
    viaUrdu: 'سیدھی لکیر کا اندازہ، سڑک کا ڈیٹا دستیاب نہیں۔ درست رہنمائی کے لیے انٹرنیٹ سے جڑیں',
    distanceKm: km,
    durationMinutes: minutes,
    hasTolls: false,
    isRecommended: true,
    steps: [
      { instruction: 'Head toward your destination', instructionUrdu: 'اپنی منزل کی طرف روانہ ہوں', distanceMeters: Math.max(1, meters - 1), durationSeconds: Math.max(1, minutes * 60 - 1), maneuver: 'straight' },
      { instruction: 'Arrive at destination', instructionUrdu: 'منزل پر پہنچیں', distanceMeters: 1, durationSeconds: 1, maneuver: 'arrive' }
    ],
    pathCoordinates: path
  };
}

export async function fetchRoutes(
  req: RouteRequest,
  opts: { fetchImpl?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<RouteResult> {
  const f = opts.fetchImpl ?? fetch;
  try {
    const signals = [AbortSignal.timeout(opts.timeoutMs ?? 6000)];
    if (opts.signal) signals.push(opts.signal);
    const res = await f(buildOsrmUrl(req), { signal: AbortSignal.any(signals) });
    if (res.ok) {
      const routes = parseOsrmRoutes(await res.json(), req);
      if (routes.length) return { routes, source: 'network' };
    }
  } catch (err) {
    if (opts.signal?.aborted) throw err; // caller cancelled: don't mask it as an estimate
  }
  return { routes: [estimateRoute(req)], source: 'estimate' };
}

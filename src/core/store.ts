/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { create } from 'zustand';
import { LocationPoint, RouteOption, TravelMode } from '../types';
import { LatLng, bearingDeg, haversineM } from './geo';
import { Fix, NavSession, createSession, updateSession } from './navigation';
import { Announcement, nextAnnouncement, simpleAnnouncement } from './announcer';
import { fetchRoutes, RouteResult } from './routing';

export interface GpsStatus {
  signalLost: boolean;
  accuracyWarning: boolean;
  error: string | null;
}

export type StartResult = { ok: true } | { ok: false; reason: 'no_fix' | 'no_route' };

export interface AppState {
  cityCenter: LatLng;
  fix: Fix | null;
  heading: number;
  gps: GpsStatus;

  destination: LocationPoint | null;
  travelMode: TravelMode;
  routes: RouteOption[];
  routesSource: RouteResult['source'] | null;
  routesLoading: boolean;
  activeRouteId: string | null;

  session: NavSession | null;
  rerouting: boolean;
  voiceMuted: boolean;
  announcement: (Announcement & { seq: number }) | null;

  setCityCenter: (c: LatLng) => void;
  setGps: (g: Partial<GpsStatus>) => void;
  setFix: (fix: Fix) => void;
  setDestination: (d: LocationPoint | null) => void;
  setTravelMode: (m: TravelMode) => void;
  selectRoute: (id: string) => void;
  loadRoutes: () => Promise<void>;
  startNavigation: () => StartResult;
  stopNavigation: () => void;
  toggleMute: () => void;
}

// Module-level bookkeeping that must not trigger renders
let routeRequestSeq = 0;
let routeAbort: AbortController | null = null;
let lastRerouteAt = 0;
let announceSeq = 0;
let announced = new Set<string>();
export const REROUTE_MIN_INTERVAL_MS = 10_000;

export const activeRouteOf = (s: Pick<AppState, 'routes' | 'activeRouteId'>): RouteOption | null =>
  s.routes.find((r) => r.id === s.activeRouteId) ?? null;

export const routeStartOf = (s: Pick<AppState, 'fix' | 'cityCenter'>): LatLng => s.fix ?? s.cityCenter;

export const useAppStore = create<AppState>((set, get) => {
  const announce = (a: Announcement | null) => {
    if (!a) return;
    announced.add(a.key);
    set({ announcement: { ...a, seq: ++announceSeq } });
  };

  const reroute = async () => {
    const st = get();
    if (st.rerouting || !st.destination || !st.fix) return;
    if (Date.now() - lastRerouteAt < REROUTE_MIN_INTERVAL_MS) return;
    lastRerouteAt = Date.now();
    set({ rerouting: true });
    const seq = ++routeRequestSeq;
    try {
      const res = await fetchRoutes({ from: st.fix, to: st.destination, destId: st.destination.id, mode: st.travelMode });
      const cur = get();
      if (seq !== routeRequestSeq || !cur.session) return; // navigation stopped or superseded
      const best = res.routes[0];
      announced = new Set();
      set({ routes: res.routes, routesSource: res.source, activeRouteId: best.id, session: createSession(best) });
      announce(simpleAnnouncement(`${best.id}:reroute`, 'reroute'));
    } catch {
      /* cancelled */
    } finally {
      set({ rerouting: false });
    }
  };

  return {
    cityCenter: { lat: 31.5204, lng: 74.3587 },
    fix: null,
    heading: 0,
    gps: { signalLost: false, accuracyWarning: false, error: null },

    destination: null,
    travelMode: 'DRIVING',
    routes: [],
    routesSource: null,
    routesLoading: false,
    activeRouteId: null,

    session: null,
    rerouting: false,
    voiceMuted: false,
    announcement: null,

    setCityCenter: (c) => set({ cityCenter: c }),
    setGps: (g) => set((s) => ({ gps: { ...s.gps, ...g } })),

    setFix: (fix) => {
      const prev = get().fix;
      let heading = get().heading;
      if (fix.heading != null && Number.isFinite(fix.heading)) heading = fix.heading;
      else if (prev && haversineM(prev, fix) > 5) heading = bearingDeg(prev, fix);
      set({ fix, heading });

      const { session, routes, activeRouteId } = get();
      const route = routes.find((r) => r.id === activeRouteId);
      if (!session || !route) return;
      const next = updateSession(session, route, fix);
      if (next === session) return;
      set({ session: next });
      announce(nextAnnouncement(next, route, announced));
      if (next.status === 'off_route') void reroute();
    },

    setDestination: (d) => {
      routeAbort?.abort();
      routeRequestSeq++;
      announced = new Set();
      set({ destination: d, routes: [], routesSource: null, routesLoading: false, activeRouteId: null, session: null, rerouting: false });
    },

    setTravelMode: (m) => {
      if (get().session) return; // changing mode mid-trip would invalidate the route
      set({ travelMode: m, routes: [], activeRouteId: null, routesSource: null });
    },

    selectRoute: (id) => {
      if (get().session) return;
      if (get().routes.some((r) => r.id === id)) set({ activeRouteId: id });
    },

    loadRoutes: async () => {
      const st = get();
      if (!st.destination || st.session) return;
      routeAbort?.abort();
      routeAbort = new AbortController();
      const seq = ++routeRequestSeq;
      set({ routesLoading: true });
      try {
        const res = await fetchRoutes(
          { from: routeStartOf(st), to: st.destination, destId: st.destination.id, mode: st.travelMode },
          { signal: routeAbort.signal }
        );
        if (seq !== routeRequestSeq) return; // a newer request owns the state
        const keep = get().activeRouteId;
        set({
          routes: res.routes,
          routesSource: res.source,
          routesLoading: false,
          activeRouteId: res.routes.find((r) => r.id === keep)?.id ?? res.routes[0].id
        });
      } catch {
        if (seq === routeRequestSeq) set({ routesLoading: false });
      }
    },

    startNavigation: () => {
      const st = get();
      const route = activeRouteOf(st);
      if (!route) return { ok: false, reason: 'no_route' };
      if (!st.fix) return { ok: false, reason: 'no_fix' };
      announced = new Set();
      lastRerouteAt = 0;
      const session = updateSession(createSession(route), route, st.fix);
      set({ session });
      announce(simpleAnnouncement(`${route.id}:start`, 'start', route.steps[0]?.instruction));
      return { ok: true };
    },

    stopNavigation: () => {
      routeRequestSeq++;
      set({ session: null, rerouting: false, announcement: null });
    },

    toggleMute: () => set((s) => ({ voiceMuted: !s.voiceMuted }))
  };
});

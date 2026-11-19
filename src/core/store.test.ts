import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore, activeRouteOf } from './store';
import { estimateRoute } from './routing';
import * as routing from './routing';
import { RouteOption } from '../types';

const dest = (id: string, lat = 31.55, lng = 74.35) => ({ id, name: id, nameUrdu: id, lat, lng });
const reset = () => {
  useAppStore.getState().stopNavigation();
  useAppStore.setState({ fix: null, origin: null, destination: null, routes: [], activeRouteId: null, session: null, routesSource: null, voiceMuted: false, announcement: null });
};
const mockFetch = (fn: (req: any) => Promise<any>) => vi.spyOn(routing, 'fetchRoutes').mockImplementation(fn as any);

describe('app store', () => {
  beforeEach(() => { reset(); vi.restoreAllMocks(); });

  it('refuses to start without a GPS fix, then starts with one', async () => {
    mockFetch(async (req) => ({ routes: [estimateRoute(req)], source: 'estimate' }));
    const s = useAppStore.getState();
    s.setDestination(dest('a'));
    await s.loadRoutes();
    expect(useAppStore.getState().startNavigation()).toEqual({ ok: false, reason: 'no_fix' });
    useAppStore.getState().setFix({ lat: 31.5, lng: 74.3 });
    expect(useAppStore.getState().startNavigation()).toEqual({ ok: true });
    expect(useAppStore.getState().session?.status).toBe('navigating');
    expect(useAppStore.getState().announcement?.en).toMatch(/Head toward/);
  });

  it('routes from a custom start, keeps route ids distinct per start, and only previews (no navigation)', async () => {
    const seen: any[] = [];
    mockFetch(async (req) => { seen.push(req); return { routes: [estimateRoute(req)], source: 'estimate' }; });
    useAppStore.getState().setFix({ lat: 31.5, lng: 74.3 });
    useAppStore.getState().setDestination(dest('d', 31.6, 74.4));
    await useAppStore.getState().loadRoutes();
    const fromMe = activeRouteOf(useAppStore.getState())!;
    expect(seen[0].from).toEqual({ lat: 31.5, lng: 74.3 });

    useAppStore.getState().setOrigin(dest('o', 31.52, 74.32));
    expect(useAppStore.getState().routes).toEqual([]); // old route cleared at once
    await useAppStore.getState().loadRoutes();
    const fromO = activeRouteOf(useAppStore.getState())!;
    expect(seen[1].from.lat).toBeCloseTo(31.52);
    expect(fromO.id).not.toBe(fromMe.id);
    expect(useAppStore.getState().startNavigation()).toEqual({ ok: false, reason: 'custom_origin' });

    useAppStore.getState().setOrigin(null); // back to "my location"
    await useAppStore.getState().loadRoutes();
    expect(useAppStore.getState().startNavigation()).toEqual({ ok: true });
    useAppStore.getState().setOrigin(dest('x')); // can't change the start mid-trip
    expect(useAppStore.getState().origin).toBeNull();
  });

  it('a slower, older route request can never overwrite a newer destination', async () => {
    let resolveA: (v: any) => void = () => {};
    mockFetch((req) =>
      req.destId === 'a'
        ? new Promise((r) => (resolveA = r))
        : Promise.resolve({ routes: [estimateRoute(req)], source: 'estimate' })
    );
    const st = useAppStore.getState();
    st.setDestination(dest('a'));
    const pA = st.loadRoutes();
    useAppStore.getState().setDestination(dest('b', 31.6, 74.4));
    await useAppStore.getState().loadRoutes();
    resolveA({ routes: [estimateRoute({ from: { lat: 0, lng: 0 }, to: { lat: 1, lng: 1 }, destId: 'a', mode: 'DRIVING' })], source: 'estimate' });
    await pA;
    expect(activeRouteOf(useAppStore.getState())?.id).toContain('_b_');
  });

  it('changing destination clears the old route and any active session', async () => {
    mockFetch(async (req) => ({ routes: [estimateRoute(req)], source: 'estimate' }));
    useAppStore.getState().setFix({ lat: 31.5, lng: 74.3 });
    useAppStore.getState().setDestination(dest('a'));
    await useAppStore.getState().loadRoutes();
    useAppStore.getState().startNavigation();
    useAppStore.getState().setDestination(dest('b'));
    const s = useAppStore.getState();
    expect(s.session).toBeNull();
    expect(s.routes).toEqual([]);
    expect(s.activeRouteId).toBeNull();
  });

  it('cannot switch route or mode mid-trip', async () => {
    mockFetch(async (req) => ({ routes: [estimateRoute(req)], source: 'estimate' }));
    useAppStore.getState().setFix({ lat: 31.5, lng: 74.3 });
    useAppStore.getState().setDestination(dest('a'));
    await useAppStore.getState().loadRoutes();
    useAppStore.getState().startNavigation();
    useAppStore.getState().setTravelMode('WALKING');
    expect(useAppStore.getState().travelMode).toBe('DRIVING');
  });

  it('reroutes (once, from the real position) after sustained off-route fixes', async () => {
    const spy = mockFetch(async (req) => ({ routes: [estimateRoute(req)], source: 'estimate' }));
    useAppStore.getState().setFix({ lat: 31.5, lng: 74.3 });
    useAppStore.getState().setDestination(dest('a', 31.52, 74.3));
    await useAppStore.getState().loadRoutes();
    useAppStore.getState().startNavigation();
    spy.mockClear();
    const off = { lat: 31.51, lng: 74.31 }; // ~1 km east of the route
    for (let i = 0; i < 6; i++) useAppStore.getState().setFix(off);
    await vi.waitFor(() => expect(useAppStore.getState().rerouting).toBe(false));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].from).toMatchObject(off);
    expect(useAppStore.getState().session?.status).toBe('navigating');
  });

  it('arrival is reported and not undone by further fixes', async () => {
    mockFetch(async (req) => ({ routes: [estimateRoute(req)], source: 'estimate' }));
    useAppStore.getState().setFix({ lat: 31.5, lng: 74.3 });
    useAppStore.getState().setDestination(dest('a', 31.505, 74.3));
    await useAppStore.getState().loadRoutes();
    useAppStore.getState().startNavigation();
    useAppStore.getState().setFix({ lat: 31.505, lng: 74.3 });
    expect(useAppStore.getState().session?.status).toBe('arrived');
    useAppStore.getState().setFix({ lat: 31.5, lng: 74.3 });
    expect(useAppStore.getState().session?.status).toBe('arrived');
  });
});

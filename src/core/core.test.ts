import { describe, it, expect, vi } from 'vitest';
import { haversineM, bearingDeg, projectOnSegment, cumulativeLengths } from './geo';
import { matchToRoute } from './routeMatcher';
import { createSession, updateSession } from './navigation';
import { nextAnnouncement } from './announcer';
import { parseOsrmRoutes, estimateRoute, fetchRoutes, buildOsrmUrl } from './routing';
import { RouteOption } from '../types';

// A ~2 km straight route heading north along lng 74.35, with 3 steps
const path = Array.from({ length: 21 }, (_, i) => ({ lat: 31.5 + i * 0.0009, lng: 74.35 }));
const totalM = cumulativeLengths(path).at(-1)!;
const route: RouteOption = {
  id: 'r1', title: 't', titleUrdu: 't', via: '', viaUrdu: '', distanceKm: totalM / 1000, durationMinutes: 6,
  hasTolls: false, isRecommended: true, pathCoordinates: path,
  steps: [
    { instruction: 'Head north', instructionUrdu: 'شمال', distanceMeters: 1000, durationSeconds: 100, maneuver: 'straight' },
    { instruction: 'Turn left', instructionUrdu: 'بائیں', distanceMeters: 600, durationSeconds: 60, maneuver: 'turn-left' },
    { instruction: 'Arrive', instructionUrdu: 'پہنچیں', distanceMeters: 400, durationSeconds: 40, maneuver: 'arrive' }
  ]
};
const at = (m: number, dx = 0) => {
  // point m metres along the route, dx metres east
  const lat = 31.5 + m / 111195;
  return { lat, lng: 74.35 + dx / (111195 * Math.cos((31.5 * Math.PI) / 180)) };
};

describe('geo', () => {
  it('haversine ~111 km per degree of latitude', () => {
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111195, -2);
  });
  it('bearing north/east', () => {
    expect(bearingDeg({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0, 3);
    expect(bearingDeg({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90, 3);
  });
  it('projects onto a segment with clamping', () => {
    const p = projectOnSegment({ lat: 0.0005, lng: 0.0003 }, { lat: 0, lng: 0 }, { lat: 0.001, lng: 0 });
    expect(p.t).toBeCloseTo(0.5, 2);
    expect(p.distM).toBeCloseTo(33.4, 0);
    expect(projectOnSegment({ lat: -1, lng: 0 }, { lat: 0, lng: 0 }, { lat: 1, lng: 0 }).t).toBe(0);
  });
});

describe('matchToRoute', () => {
  const cum = cumulativeLengths(path);
  it('matches mid-segment (not just vertices) on a sparse polyline', () => {
    const sparse = [path[0], path[20]];
    const m = matchToRoute(sparse, cumulativeLengths(sparse), at(900, 5))!;
    expect(m.distFromRouteM).toBeLessThan(6);
    expect(m.alongM).toBeCloseTo(900, -1);
  });
  it('does not jump ahead on a loop that overlaps itself', () => {
    const loop = [...path.slice(0, 11), ...path.slice(0, 11).reverse()]; // out and back
    const c = cumulativeLengths(loop);
    const m = matchToRoute(loop, c, at(500), 480)!;
    expect(m.alongM).toBeLessThan(c[10] + 1); // outbound leg, not the return
  });
  it('recovers via global search after leaving the window', () => {
    const m = matchToRoute(path, cum, at(1700), 0)!;
    expect(m.alongM).toBeCloseTo(1700, -1);
  });
});

describe('navigation session', () => {
  it('tracks progress, remaining distance, ETA and step', () => {
    let s = createSession(route);
    s = updateSession(s, route, at(300));
    expect(s.status).toBe('navigating');
    expect(s.alongM).toBeCloseTo(300, -1);
    expect(s.remainingM).toBeCloseTo(totalM - 300, -1);
    expect(s.remainingS).toBeLessThan(6 * 60);
    expect(s.stepIndex).toBe(0);
    expect(s.upcomingStepIndex).toBe(1);
    // step 0 ends ~ at 1000/2000*totalM scaled; distance to it shrinks as we advance
    const d1 = s.distanceToManeuverM;
    s = updateSession(s, route, at(600));
    expect(s.distanceToManeuverM).toBeLessThan(d1);
  });
  it('advances to the next step after the manoeuvre point', () => {
    let s = createSession(route);
    s = updateSession(s, route, at(0.55 * totalM));
    expect(s.stepIndex).toBe(1);
    expect(s.upcomingStepIndex).toBe(2);
  });
  it('never moves progress backwards', () => {
    let s = createSession(route);
    s = updateSession(s, route, at(800));
    const a = s.alongM;
    s = updateSession(s, route, at(780));
    expect(s.alongM).toBe(a);
  });
  it('flags off-route only after 3 consecutive fixes, and recovers', () => {
    let s = createSession(route);
    for (let i = 0; i < 2; i++) s = updateSession(s, route, at(500, 200));
    expect(s.status).toBe('navigating');
    s = updateSession(s, route, at(500, 200));
    expect(s.status).toBe('off_route');
    s = updateSession(s, route, at(520, 3));
    expect(s.status).toBe('navigating');
    expect(s.offRouteCount).toBe(0);
  });
  it('tolerates poor GPS accuracy', () => {
    let s = createSession(route);
    for (let i = 0; i < 5; i++) s = updateSession(s, route, { ...at(500, 90), accuracy: 120 });
    expect(s.status).toBe('navigating');
  });
  it('arrives within 25 m of the destination and is terminal', () => {
    let s = createSession(route);
    s = updateSession(s, route, at(totalM - 10));
    expect(s.status).toBe('arrived');
    expect(s.remainingM).toBe(0);
    expect(updateSession(s, route, at(100))).toBe(s);
  });
  it('does not mutate its input', () => {
    const s = createSession(route);
    const copy = JSON.stringify(s);
    updateSession(s, route, at(300));
    expect(JSON.stringify(s)).toBe(copy);
  });
});

describe('announcer', () => {
  it('speaks each band once per manoeuvre, using the band value so clips can be pre-recorded', () => {
    let s = createSession(route);
    s = { ...s, upcomingStepIndex: 1, distanceToManeuverM: 480 };
    const seen = new Set<string>();
    const a1 = nextAnnouncement(s, route, seen)!;
    expect(a1.en).toBe('In 500 meters, Turn left');
    expect(a1).toMatchObject({ phrase: 'turn-left', distanceM: 500 });
    expect(a1.ur).toBe('500 میٹر بعد، بائیں مڑیں');
    expect(a1.pa).toContain('کھبے مڑو');
    seen.add(a1.key);
    expect(nextAnnouncement(s, route, seen)).toBeNull();
    const a2 = nextAnnouncement({ ...s, distanceToManeuverM: 150 }, route, seen)!;
    expect(a2.key).toContain(':200');
    expect(a2.distanceM).toBe(200);
    const a3 = nextAnnouncement({ ...s, distanceToManeuverM: 30 }, route, new Set())!;
    expect(a3.en).toBe('Turn left');
    expect(a3.distanceM).toBeNull();
  });
  it('is silent when far away or off-route, announces arrival once', () => {
    const s = { ...createSession(route), distanceToManeuverM: 1500 };
    expect(nextAnnouncement(s, route, new Set())).toBeNull();
    expect(nextAnnouncement({ ...s, status: 'off_route', distanceToManeuverM: 10 }, route, new Set())).toBeNull();
    const arrived = { ...s, status: 'arrived' as const };
    const a = nextAnnouncement(arrived, route, new Set())!;
    expect(a.phrase).toBe('arrived');
    expect(nextAnnouncement(arrived, route, new Set([a.key]))).toBeNull();
  });
});

describe('routing', () => {
  const req = { from: { lat: 31.5, lng: 74.3 }, to: { lat: 31.55, lng: 74.35 }, destId: 'd1', mode: 'DRIVING' as const };
  const osrm = {
    code: 'Ok',
    routes: [{
      distance: 7200, duration: 780,
      geometry: { coordinates: [[74.3, 31.5], [74.32, 31.52], [74.35, 31.55]] },
      legs: [{ steps: [
        { maneuver: { type: 'depart' }, name: 'A Rd', distance: 4000, duration: 400 },
        { maneuver: { type: 'turn', modifier: 'right' }, name: 'B Rd', distance: 3200, duration: 380 },
        { maneuver: { type: 'arrive' }, name: '', distance: 0, duration: 0 }
      ] }]
    }]
  };
  it('builds distinct ids per destination and mode', () => {
    const a = parseOsrmRoutes(osrm, req)[0];
    const b = parseOsrmRoutes(osrm, { ...req, destId: 'd2' })[0];
    expect(a.id).not.toBe(b.id);
    expect(a.distanceKm).toBe(7.2);
    expect(a.steps[1].instruction).toBe('Turn right onto B Rd');
  });
  it('rejects malformed responses', () => {
    expect(parseOsrmRoutes({ code: 'NoRoute' }, req)).toEqual([]);
    expect(parseOsrmRoutes({ code: 'Ok', routes: [{ distance: 1 }] }, req)).toEqual([]);
    expect(parseOsrmRoutes(null, req)).toEqual([]);
  });
  it('uses the foot server for walking', () => {
    expect(buildOsrmUrl({ ...req, mode: 'WALKING' })).toContain('routed-foot');
    expect(buildOsrmUrl(req)).toContain('router.project-osrm.org');
  });
  it('estimate has consistent geometry/step totals', () => {
    const r = estimateRoute(req);
    expect(r.steps.reduce((s, x) => s + x.distanceMeters, 0)).toBe(Math.round(r.distanceKm * 1000));
  });
  it('fetchRoutes returns network routes, else an estimate', async () => {
    const ok = vi.fn().mockResolvedValue({ ok: true, json: async () => osrm });
    expect((await fetchRoutes(req, { fetchImpl: ok as any })).source).toBe('network');
    const bad = vi.fn().mockRejectedValue(new Error('offline'));
    const r = await fetchRoutes(req, { fetchImpl: bad as any });
    expect(r.source).toBe('estimate');
    expect(r.routes).toHaveLength(1);
    const http500 = vi.fn().mockResolvedValue({ ok: false });
    expect((await fetchRoutes(req, { fetchImpl: http500 as any })).source).toBe('estimate');
  });
  it('propagates caller cancellation', async () => {
    const ac = new AbortController();
    ac.abort();
    const f = vi.fn().mockRejectedValue(new DOMException('x', 'AbortError'));
    await expect(fetchRoutes(req, { fetchImpl: f as any, signal: ac.signal })).rejects.toBeTruthy();
  });
});

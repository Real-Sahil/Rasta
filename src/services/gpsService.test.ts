import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateDistanceMeters, snapToRoutePolyline, RobustGpsManager } from './gpsService';

describe('calculateDistanceMeters', () => {
  it('computes haversine distance (~1.4 km for 0.01° diagonal in Lahore)', () => {
    const d = calculateDistanceMeters({ lat: 31.5204, lng: 74.3587 }, { lat: 31.5304, lng: 74.3687 });
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(2000);
  });
  it('is zero for identical points', () => {
    expect(calculateDistanceMeters({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
  });
});

describe('snapToRoutePolyline', () => {
  const polyline = [
    { lat: 31.52, lng: 74.358 },
    { lat: 31.525, lng: 74.358 },
    { lat: 31.53, lng: 74.358 }
  ];
  it('snaps a point ~30 m off the route', () => {
    const r = snapToRoutePolyline({ lat: 31.525, lng: 74.3583 }, polyline, 50);
    expect(r.snapped).toBe(true);
    expect(r.lng).toBeCloseTo(74.358, 5);
  });
  it('does not snap a point far from the route', () => {
    expect(snapToRoutePolyline({ lat: 31.525, lng: 74.37 }, polyline, 50).snapped).toBe(false);
  });
  it('does not snap with fewer than two route points', () => {
    expect(snapToRoutePolyline({ lat: 1, lng: 1 }, [{ lat: 1, lng: 1 }]).snapped).toBe(false);
  });
});

describe('RobustGpsManager', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('reports NOT_SUPPORTED when geolocation is unavailable', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', {});
    const errors: (string | null)[] = [];
    new RobustGpsManager((s) => errors.push(s.error)).startWatching();
    expect(errors).toContain('NOT_SUPPORTED');
  });
});

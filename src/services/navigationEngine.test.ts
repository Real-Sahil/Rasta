import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NavigationEngine, NavigationEngineEvent } from './navigationEngine';
import { RouteOption } from '../types';

const route: RouteOption = {
  id: 'test_route_1',
  title: 'Test', titleUrdu: 'ٹیسٹ', via: 'v', viaUrdu: 'v',
  distanceKm: 5, durationMinutes: 12, hasTolls: false, isRecommended: true,
  steps: [
    { instruction: 'Head north', instructionUrdu: 'شمال', distanceMeters: 2000, durationSeconds: 300, maneuver: 'straight' },
    { instruction: 'Arrive', instructionUrdu: 'پہنچیں', distanceMeters: 3000, durationSeconds: 420, maneuver: 'arrive' }
  ],
  pathCoordinates: [
    { lat: 31.52, lng: 74.358 },
    { lat: 31.525, lng: 74.358 },
    { lat: 31.53, lng: 74.358 },
    { lat: 31.535, lng: 74.358 }
  ]
};
const dest = { id: 'd', name: 'D', nameUrdu: 'D', category: 'hub' as const, lat: 31.535, lng: 74.358 };

describe('NavigationEngine', () => {
  let engine: NavigationEngine;
  let last: NavigationEngineEvent;
  beforeEach(() => {
    vi.useFakeTimers();
    engine = new NavigationEngine();
    engine.subscribe((e) => (last = e));
  });
  afterEach(() => vi.useRealTimers());

  it('starts IDLE', () => expect(last.state).toBe('IDLE'));

  it('moves to NAVIGATING on start', () => {
    engine.startNavigation(route, dest);
    expect(last.state).toBe('NAVIGATING');
    expect(last.activeRoute?.id).toBe('test_route_1');
  });

  it('stays NAVIGATING for an on-route position', () => {
    engine.startNavigation(route, dest);
    engine.processPositionUpdate({ lat: 31.525, lng: 74.358 });
    expect(last.state).toBe('NAVIGATING');
  });

  it('needs 3 consecutive off-route fixes before OFF_ROUTE/REROUTING', () => {
    engine.startNavigation(route, dest);
    const off = { lat: 31.525, lng: 74.375 };
    engine.processPositionUpdate(off);
    engine.processPositionUpdate(off);
    expect(last.state).toBe('NAVIGATING');
    engine.processPositionUpdate(off);
    expect(['OFF_ROUTE', 'REROUTING']).toContain(last.state);
  });

  it('returns to NAVIGATING after the reroute delay', () => {
    engine.startNavigation(route, dest);
    const off = { lat: 31.525, lng: 74.375 };
    for (let i = 0; i < 3; i++) engine.processPositionUpdate(off);
    vi.advanceTimersByTime(1300);
    expect(last.state).toBe('NAVIGATING');
  });

  it('reaches ARRIVED within 25 m of the destination', () => {
    engine.startNavigation(route, dest);
    engine.processPositionUpdate({ lat: 31.535, lng: 74.358 });
    expect(last.state).toBe('ARRIVED');
  });

  it('ignores positions when not navigating', () => {
    engine.processPositionUpdate({ lat: 31.525, lng: 74.358 });
    expect(last.state).toBe('IDLE');
  });
});

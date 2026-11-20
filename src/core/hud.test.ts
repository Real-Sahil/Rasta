import { describe, expect, it } from 'vitest';
import { RouteOption } from '../types';
import { createSession, NavSession } from './navigation';
import { hapticFor, thenPhrase, thenText, tripProgress } from './hud';

const step = (maneuver: RouteOption['steps'][number]['maneuver'], distanceMeters: number) =>
  ({ instruction: '', instructionUrdu: '', distanceMeters, durationSeconds: 10, maneuver });

const route = (steps: RouteOption['steps']): RouteOption => ({
  id: 'r', name: '', nameUrdu: '', via: '', viaUrdu: '', distanceKm: 1, durationMinutes: 5, hasTolls: false, isRecommended: true,
  steps,
  pathCoordinates: [{ lat: 31.5, lng: 74.3 }, { lat: 31.5, lng: 74.3 + 0.0105 }] // ~1 km east
} as unknown as RouteOption);

const at = (s: NavSession, stepIndex: number): NavSession => ({ ...s, stepIndex, upcomingStepIndex: stepIndex + 1 });

describe('thenPhrase', () => {
  it('names the following turn when it comes soon after the next one', () => {
    const r = route([step('straight', 500), step('turn-left', 150), step('turn-right', 350)]);
    expect(thenPhrase(at(createSession(r), 0), r)).toBe('turn-right');
  });
  it('stays quiet when the turns are far apart', () => {
    const r = route([step('straight', 300), step('turn-left', 600), step('turn-right', 100)]);
    expect(thenPhrase(at(createSession(r), 0), r)).toBeNull();
  });
  it('skips "continue straight" and the last step', () => {
    const r = route([step('straight', 500), step('turn-left', 100), step('straight', 400)]);
    expect(thenPhrase(at(createSession(r), 0), r)).toBeNull();
    expect(thenPhrase({ ...createSession(r), stepIndex: 2, upcomingStepIndex: 2 }, r)).toBeNull();
  });
  it('is off while off route or arrived', () => {
    const r = route([step('straight', 500), step('turn-left', 150), step('turn-right', 350)]);
    expect(thenPhrase({ ...at(createSession(r), 0), status: 'off_route' }, r)).toBeNull();
  });
  it('reads naturally', () => {
    expect(thenText('turn-right', 'en', 'Then')).toBe('Then turn right');
  });
});

describe('tripProgress', () => {
  it('runs from 0 to 1', () => {
    const s = createSession(route([step('arrive', 1000)]));
    expect(tripProgress(s)).toBe(0);
    expect(tripProgress({ ...s, alongM: s.totalM / 2 })).toBeCloseTo(0.5);
    expect(tripProgress({ ...s, status: 'arrived' })).toBe(1);
    expect(tripProgress({ ...s, totalM: 0 })).toBe(0);
  });
});

describe('hapticFor', () => {
  it('buzzes for the 200 m warning and arrival only', () => {
    expect(hapticFor({ key: 'r:3:200' })).toBe('turn');
    expect(hapticFor({ key: 'r:3:500' })).toBeNull();
    expect(hapticFor({ key: 'r:3:50' })).toBeNull();
    expect(hapticFor({ key: 'r:arrived' })).toBe('arrive');
    expect(hapticFor({ key: 'r:start' })).toBeNull();
  });
});

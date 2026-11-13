import { describe, it, expect } from 'vitest';
import { osrmStep } from './routeInstructions';

describe('osrmStep', () => {
  it('maps a left turn with a street name', () => {
    const s = osrmStep({ maneuver: { type: 'turn', modifier: 'left' }, name: 'Mall Road', distance: 120.4, duration: 20 });
    expect(s.instruction).toBe('Turn left onto Mall Road');
    expect(s.maneuver).toBe('turn-left');
    expect(s.distanceMeters).toBe(120);
    expect(s.instructionUrdu).toBe('بائیں مڑیں');
  });
  it('maps arrive', () => {
    const s = osrmStep({ maneuver: { type: 'arrive' }, distance: 0, duration: 0 });
    expect(s.maneuver).toBe('arrive');
    expect(s.instruction).toBe('Arrive at destination');
  });
  it('maps roundabouts and falls back safely on missing data', () => {
    expect(osrmStep({ maneuver: { type: 'roundabout' }, distance: 1, duration: 1 }).maneuver).toBe('roundabout');
    expect(() => osrmStep({ distance: 1, duration: 1 })).not.toThrow();
  });
});

import { describe, it, expect } from 'vitest';
import { PK_CITIES, CITY_CENTERS, nearestCityId } from './pakistanLocations';
import { inPakistan } from '../core/coverage';

describe('weather cities', () => {
  it('every listed city is inside Pakistan and has an Urdu name', () => {
    for (const c of PK_CITIES) {
      expect(inPakistan(c.lat, c.lng), c.id).toBe(true);
      expect(c.ur.length, c.id).toBeGreaterThan(1);
      expect(CITY_CENTERS[c.id]).toEqual({ lat: c.lat, lng: c.lng });
    }
  });
  it('picks the nearest city within 80 km of a real fix, else none', () => {
    expect(nearestCityId({ lat: 34.0, lng: 71.56 })).toBe('peshawar');
    expect(nearestCityId({ lat: 30.2, lng: 67.0 })).toBe('quetta');
    expect(nearestCityId({ lat: 28.5, lng: 64.5 })).toBeNull(); // central Balochistan: nothing close
    expect(nearestCityId(null)).toBeNull();
  });
});

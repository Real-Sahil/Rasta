import { describe, it, expect } from 'vitest';
import { ORANGELINE_STATIONS, METROBUS_STATIONS, HOSPITALS, FUEL_STATIONS, stationName } from './osmData';

describe('osmData', () => {
  it('exposes arrays (possibly empty before the first data refresh) and never throws on import', () => {
    for (const list of [ORANGELINE_STATIONS, METROBUS_STATIONS, HOSPITALS, FUEL_STATIONS]) expect(Array.isArray(list)).toBe(true);
  });
  it('every item that exists has real coordinates inside Pakistan and an OSM id', () => {
    for (const x of [...ORANGELINE_STATIONS, ...METROBUS_STATIONS, ...HOSPITALS, ...FUEL_STATIONS]) {
      expect(x.lat).toBeGreaterThan(23); expect(x.lat).toBeLessThan(37.5);
      expect(x.lng).toBeGreaterThan(60); expect(x.lng).toBeLessThan(77.9);
      expect(x.osmId).toMatch(/^(node|way|relation)\/\d+$/);
    }
  });
  it('falls back to the English name when there is no Urdu name', () => {
    expect(stationName({ name: 'A', nameUrdu: null }, true)).toBe('A');
    expect(stationName({ name: 'A', nameUrdu: 'ا' }, true)).toBe('ا');
    expect(stationName({ name: 'A', nameUrdu: 'ا' }, false)).toBe('A');
  });
});

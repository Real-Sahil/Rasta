import { describe, it, expect } from 'vitest';
import { clipAndSimplify, simplifyRing, isWgs84Prj } from '../../scripts/lib/flood.mjs';

const sq = (x: number, y: number, s: number) => [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]];
const feat = (coords: number[][][]) => ({ geometry: { type: 'Polygon', coordinates: coords } });
const bbox = [74, 31, 75, 32];

describe('flood helpers', () => {
  it('keeps polygons in the bbox and drops others', () => {
    const out = clipAndSimplify([feat([sq(74.2, 31.2, 0.05)]), feat([sq(70, 25, 0.05)])], { bbox });
    expect(out).toHaveLength(1);
  });
  it('drops specks below the minimum area', () => {
    expect(clipAndSimplify([feat([sq(74.2, 31.2, 0.00001)])], { bbox })).toHaveLength(0);
  });
  it('simplifies collinear points but keeps corners', () => {
    const ring = [[0, 0], [0.5, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
    const s = simplifyRing(ring, 0.001);
    expect(s.length).toBe(5);
  });
  it('handles MultiPolygon and rounds coordinates', () => {
    const f = { geometry: { type: 'MultiPolygon', coordinates: [[sq(74.123456, 31.123456, 0.05)]] } };
    const out = clipAndSimplify([f], { bbox });
    expect(out[0][0][0][0]).toBe(74.1235);
  });
  it('accepts only geographic WGS84 projection files', () => {
    expect(isWgs84Prj('GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984"]]')).toBe(true);
    expect(isWgs84Prj('PROJCS["WGS_1984_UTM_Zone_43N",GEOGCS["GCS_WGS_1984"]]')).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
// @ts-expect-error plain JS module
import { orderedStops, toStation, toPoi, withMeta } from './osm.mjs';

const nodes = [
  { type: 'node', id: 1, lat: 31.45, lon: 74.24, tags: { name: 'Ali Town', 'name:ur': 'علی ٹاؤن' } },
  { type: 'node', id: 2, lat: 31.46, lon: 74.23, tags: { name: 'Thokar Niaz Baig' } },
  { type: 'node', id: 3, lat: 31.47, lon: 74.24, tags: {} },
  { type: 'node', id: 4, lat: 31.48, lon: 74.25, tags: { name: 'Hanjarwal' } }
];
const rel = { type: 'relation', id: 9, members: [
  { type: 'node', ref: 2, role: 'stop' }, { type: 'node', ref: 1, role: 'stop' }, { type: 'node', ref: 1, role: 'platform' },
  { type: 'node', ref: 3, role: 'stop' }, { type: 'way', ref: 77, role: '' }, { type: 'node', ref: 4, role: 'stop_entry_only' }
] };

describe('osm helpers', () => {
  it('keeps relation order, drops duplicates, unnamed nodes and non-nodes', () => {
    expect(orderedStops(rel, nodes).map((n: any) => n.id)).toEqual([2, 1, 4]);
  });
  it('builds stations and never invents Urdu names', () => {
    const [a, b] = orderedStops(rel, nodes).map((n: any, i: number) => toStation(n, i, 'orangeline', 'OL'));
    expect(a).toMatchObject({ code: 'OL01', name: 'Thokar Niaz Baig', nameUrdu: null, osmId: 'node/2' });
    expect(b.nameUrdu).toBe('علی ٹاؤن');
  });
  it('maps POIs, skips unnamed or location-less elements, marks unknowns as null', () => {
    const p = toPoi({ type: 'way', id: 5, center: { lat: 31.5, lon: 74.3 }, tags: { name: 'Services Hospital', emergency: 'yes', 'addr:street': 'Jail Road' } }, 'hospital');
    expect(p).toMatchObject({ id: 'osm_way_5', lat: 31.5, address: 'Jail Road', emergency: true, open24h: null, phone: null });
    expect(toPoi({ type: 'node', id: 6, lat: 1, lon: 1, tags: {} }, 'fuel')).toBeNull();
    expect(toPoi({ type: 'way', id: 7, tags: { name: 'x' } }, 'fuel')).toBeNull();
  });
  it('stamps licence and count metadata', () => {
    const w = withMeta([1, 2], { fetchedAt: 'now' });
    expect(w.meta.count).toBe(2);
    expect(w.meta.source).toMatch(/ODbL/);
  });
});

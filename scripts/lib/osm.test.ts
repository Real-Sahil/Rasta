import { describe, it, expect } from 'vitest';
import { orderedStops, toStation, toPoi, withMeta, pickLines, baseLineName, stationsAlong, trackOf, stationsNearTrack, tidyLineStations, trackPoints } from './osm.mjs';

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

describe('pickLines (metro / BRT outside Lahore)', () => {
  const node = (id: number, name: string | null, ur?: string) => ({ type: 'node', id, lat: 24.9 + id / 1000, lon: 67.0 + id / 1000, tags: name ? { name, ...(ur ? { 'name:ur': ur } : {}) } : {} });
  const route = (id: number, name: string, stops: number[], extra: Record<string, string> = {}) => ({
    type: 'relation', id, tags: { type: 'route', route: 'bus', name, ...extra }, members: stops.map((ref) => ({ type: 'node', ref, role: 'stop' }))
  });
  const nodes = [1, 2, 3, 4, 5, 6].map((i) => node(i, `Stop ${i}`)).concat([node(7, null), node(8, 'Numaish', 'نمائش')]);

  it('groups directions by route_master, keeps the longest variant and master tags, drops feeders and short routes', () => {
    const els = [
      ...nodes,
      route(10, 'Green Line BRT: Surjani => Numaish', [1, 2, 3, 4, 5, 7, 8]),
      route(11, 'Green Line BRT: Numaish => Surjani', [8, 5, 4, 3]),
      { type: 'relation', id: 20, tags: { type: 'route_master', name: 'Green Line BRT', 'name:ur': 'گرین لائن', colour: '#00A651', ref: 'GL' }, members: [{ type: 'relation', ref: 10 }, { type: 'relation', ref: 11 }] },
      route(12, 'Feeder Route F-1', [1, 2, 3, 4, 5, 6]),
      route(13, 'Orange Line', [1, 2])
    ];
    const lines = pickLines(els, 'karachi');
    expect(lines).toHaveLength(1);
    const l = lines[0];
    expect(l).toMatchObject({ id: 'karachi_green-line-brt', city: 'karachi', name: 'Green Line BRT', nameUrdu: 'گرین لائن', ref: 'GL', colour: '#00A651', relation: 'relation/10' });
    expect(l.stations.map((s: any) => s.name)).toEqual(['Stop 1', 'Stop 2', 'Stop 3', 'Stop 4', 'Stop 5', 'Numaish']); // unnamed stop skipped
    expect(l.stations[5]).toMatchObject({ id: 'karachi_green-line-brt_06', nameUrdu: 'نمائش', line: 'karachi_green-line-brt', osmId: 'node/8' });
    expect(l.stations[0].nameUrdu).toBeNull();
  });
  it('without a master, groups by base name and gives unknown values as null', () => {
    const lines = pickLines([...nodes, route(30, 'Metro Bus: A => B', [1, 2, 3, 4, 5]), route(31, 'Metro Bus: B => A', [5, 4, 3, 2, 1, 6], { colour: 'red' })], 'multan');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ name: 'Metro Bus', nameUrdu: null, colour: null, ref: null, relation: 'relation/31' });
  });
  it('baseLineName strips the direction', () => {
    expect(baseLineName('Red Line: Saddar → Pak Secretariat')).toBe('Red Line');
    expect(baseLineName('Zu Route 1')).toBe('Zu Route 1');
  });
});

describe('fetch-osm queries', () => {
  it('never writes ";->" (Overpass rejects it: the set name follows the closing bracket directly)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../fetch-osm.mjs', import.meta.url), 'utf8');
    expect(src).not.toMatch(/;\s*->/);
  });
});

describe('orderedStops with platform ways', () => {
  it('uses a platform way centre, skips road ways and counts stop + platform of one station once', () => {
    const els = [
      { type: 'node', id: 10, lat: 30.2, lon: 71.5, tags: { name: 'Chowk Kumharan' } },
      { type: 'way', id: 20, center: { lat: 30.21, lon: 71.51 }, tags: { name: 'Chowk Kumharan', public_transport: 'platform' } },
      { type: 'way', id: 21, center: { lat: 30.25, lon: 71.52 }, tags: { name: 'BZU', public_transport: 'platform' } },
      { type: 'way', id: 22, center: { lat: 30.3, lon: 71.53 }, tags: { name: 'Bosan Road', highway: 'primary' } }
    ];
    const r = { type: 'relation', id: 1, members: [
      { type: 'node', ref: 10, role: 'stop' }, { type: 'way', ref: 20, role: 'platform' },
      { type: 'way', ref: 21, role: 'platform' }, { type: 'way', ref: 22, role: '' }
    ] };
    expect(orderedStops(r, els).map((e) => [e.tags.name, e.lat])).toEqual([['Chowk Kumharan', 30.2], ['BZU', 30.25]]);
  });
});

describe('lines drawn as a track only', () => {
  // A north-south track in two ways (second one drawn backwards) and three named stations, one far away.
  const route = {
    type: 'relation', id: 9, tags: { type: 'route', route: 'bus', name: 'Multan Metro Bus' },
    members: [
      { type: 'way', ref: 1, role: '', geometry: [{ lat: 30.10, lon: 71.50 }, { lat: 30.15, lon: 71.50 }] },
      { type: 'way', ref: 2, role: '', geometry: [{ lat: 30.25, lon: 71.50 }, { lat: 30.15, lon: 71.50 }] }
    ]
  };
  const st = (id, name, lat, lon) => ({ type: 'node', id, lat, lon, tags: { public_transport: 'station', name } });
  const stations = [st(1, 'North End', 30.249, 71.5005), st(2, 'South End', 30.101, 71.4995), st(3, 'Middle', 30.17, 71.501), st(4, 'Far Away', 30.17, 71.6)];

  it('chains the ways, keeps stations near the track and orders them along it', () => {
    expect(stationsAlong(trackOf(route), stations).map((s) => s.tags.name)).toEqual(['South End', 'Middle', 'North End']);
  });

  it('pickLines falls back to the track and says so', () => {
    const [l] = pickLines([route], 'multan', { stations, minStops: 3 });
    expect(l.stopsFrom).toBe('track');
    expect(l.stations.map((s) => s.name)).toEqual(['South End', 'Middle', 'North End']);
  });

  it('refuses a track with too many breaks', () => {
    const broken = { members: [0, 1, 2, 3].map((i) => ({ type: 'way', ref: i, role: '', geometry: [{ lat: 30 + i, lon: 71 }, { lat: 30 + i + 0.01, lon: 71 }] })) };
    expect(trackOf(broken)).toBeNull();
  });
});

describe('unordered tracks and line-word tidying', () => {
  const st = (id, name, lat, lon) => ({ type: 'node', id, lat, lon, tags: { public_transport: 'station', name } });

  it('orders stations near an unordered track by a nearest-neighbour chain from one end', () => {
    // an L-shaped line: south->north, then east; ways listed out of order
    const r = { members: [
      { type: 'way', role: '', geometry: [{ lat: 33.70, lon: 73.00 }, { lat: 33.70, lon: 73.10 }] },
      { type: 'way', role: '', geometry: [{ lat: 33.60, lon: 73.00 }, { lat: 33.70, lon: 73.00 }] }
    ] };
    const pts = trackPoints(r).flatMap((p, i, a) => (i ? [{ lat: (p.lat + a[i - 1].lat) / 2, lon: (p.lon + a[i - 1].lon) / 2 }, p] : [p]));
    const out = stationsNearTrack(pts, [st(1, 'Corner', 33.70, 73.0), st(2, 'East', 33.70, 73.10), st(3, 'South', 33.60, 73.0), st(4, 'Mid', 33.65, 73.0), st(5, 'Off', 33.5, 72.5)]);
    const names = out.map((s) => s.tags.name);
    expect(names.length).toBe(4);
    expect([names, [...names].reverse()]).toContainEqual(['South', 'Mid', 'Corner', 'East']);
  });

  it('drops a nearby bus stand when most stations carry the line word, and trims that word', () => {
    const out = tidyLineStations([st(1, 'Gulgasht Metrobus', 0, 0), st(2, 'General Bus Stand', 0, 0), st(3, 'Metro Bus Terminal Faizabad', 0, 0), st(4, 'NUST Metro Bus Station', 0, 0), st(5, 'G10 Metro Station', 0, 0)]);
    expect(out.map((s) => s.tags.name)).toEqual(['Gulgasht', 'Faizabad', 'NUST', 'G10']);
    expect(out[1].osmName).toBe('Metro Bus Terminal Faizabad');
  });

  it('keeps every station when the line word is not the norm', () => {
    expect(tidyLineStations([st(1, 'A', 0, 0), st(2, 'B', 0, 0), st(3, 'C Metro Station', 0, 0)]).length).toBe(3);
  });
});

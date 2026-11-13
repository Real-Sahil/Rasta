#!/usr/bin/env node
// Pull real Lahore transit stops, hospitals and fuel stations from OpenStreetMap (Overpass API)
// into src/data/osm/*.json. Run: npm run data:osm   (needs network access to overpass-api.de)
import { mkdir, writeFile } from 'node:fs/promises';
import { orderedStops, toStation, toPoi, withMeta } from './lib/osm.mjs';

const ENDPOINT = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const BBOX = '31.30,74.10,31.70,74.60'; // south,west,north,east: Lahore
const OUT = new URL('../src/data/osm/', import.meta.url);
const fetchedAt = new Date().toISOString();

async function overpass(query) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'buraq-pakistan-data-build/1.0' },
      body: 'data=' + encodeURIComponent(query)
    });
    if (res.ok) return (await res.json()).elements;
    if (![429, 504].includes(res.status)) throw new Error(`Overpass ${res.status}: ${(await res.text()).slice(0, 200)}`);
    await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
  throw new Error('Overpass busy, try again later');
}

async function routeStops({ filter, line, code }) {
  const q = `[out:json][timeout:90];rel${filter}(${BBOX})->.r;(.r;node(r.r););out body;`;
  const els = await overpass(q);
  const rels = els.filter((e) => e.type === 'relation');
  if (!rels.length) return { items: [], query: q, note: 'no route relation found' };
  // use the relation with the most named stops (usually the full line; ignores short-turn variants)
  const best = rels.map((r) => ({ r, stops: orderedStops(r, els) })).sort((a, b) => b.stops.length - a.stops.length)[0];
  return { items: best.stops.map((n, i) => toStation(n, i, line, code)), query: q, relation: `relation/${best.r.id}`, relationName: best.r.tags?.name };
}

const poi = async (selector, kind) => {
  const q = `[out:json][timeout:90];nwr${selector}(${BBOX});out center tags;`;
  const items = (await overpass(q)).map((e) => toPoi(e, kind)).filter(Boolean);
  return { items, query: q };
};

const jobs = {
  orangeline: () => routeStops({ filter: '["route"~"^(subway|light_rail|train)$"]["name"~"Orange",i]', line: 'orangeline', code: 'OL' }),
  metrobus: () => routeStops({ filter: '["route"="bus"]["name"~"Metro ?bus",i]["name"!~"feeder",i]', line: 'metrobus', code: 'MB' }),
  hospitals: () => poi('["amenity"="hospital"]', 'hospital'),
  fuel: () => poi('["amenity"="fuel"]', 'fuel')
};

await mkdir(OUT, { recursive: true });
for (const [name, job] of Object.entries(jobs)) {
  const { items, query, ...extra } = await job();
  await writeFile(new URL(`${name}.json`, OUT), JSON.stringify(withMeta(items, { fetchedAt, bbox: BBOX, query, ...extra }), null, 1) + '\n');
  console.log(`${name}: ${items.length} items${extra.relationName ? ` (${extra.relationName})` : ''}`);
  await new Promise((r) => setTimeout(r, 2000)); // be polite to the public server
}

#!/usr/bin/env node
// Pull real Lahore transit stops, hospitals and fuel stations from OpenStreetMap (Overpass API)
// into src/data/osm/*.json. Run: npm run data:osm   (needs network access to overpass-api.de)
import { mkdir, writeFile } from 'node:fs/promises';
import { describeRoute, orderedStops, pickLines, toStation, toPoi, withMeta } from './lib/osm.mjs';

const ENDPOINTS = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const BBOX = '31.30,74.10,31.70,74.60'; // south,west,north,east: Lahore
const OUT = new URL('../src/data/osm/', import.meta.url);
const fetchedAt = new Date().toISOString();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

// Public Overpass servers are often busy: rotate mirrors and back off exponentially.
async function overpass(query) {
  let lastErr;
  for (let attempt = 0; attempt < 6; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'buraq-pakistan-data-build/1.0' },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(120_000)
      });
      if (res.ok) return (await res.json()).elements;
      const why = res.status >= 400 && res.status < 500 ? `: ${(await res.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)}` : '';
      lastErr = new Error(`Overpass ${res.status} from ${new URL(endpoint).host}${why}`);
      if (!RETRYABLE.has(res.status)) throw lastErr;
    } catch (e) {
      lastErr = e;
      if (e === lastErr && String(e.message).startsWith('Overpass 4')) throw e; // non-retryable client error
    }
    console.warn(`  retry ${attempt + 1}: ${lastErr.message}`);
    await sleep(Math.min(60_000, 4_000 * 2 ** attempt));
  }
  throw lastErr;
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

// Metro / BRT outside Lahore (Lahore's two lines keep their own files). Areas are generous city boxes: s,w,n,e.
const METRO_CITIES = {
  islamabad_rawalpindi: '33.45,72.80,33.85,73.30',
  multan: '30.05,71.35,30.35,71.62',
  peshawar: '33.90,71.38,34.12,71.68',
  karachi: '24.75,66.85,25.10,67.30'
};
const TRANSIT_ROUTE = '["type"="route"]["route"~"^(bus|trolleybus|light_rail|subway|train|tram|monorail)$"]';
// Plain alternation only: Overpass rejected bracket classes here with HTTP 400.
const METRO_OPERATOR = 'transpeshawar|mass transit|metro';
const METRO_NAME = 'metro|brt|bus rapid|green line|red line|blue line|orange line|zu peshawar|zu bus';

async function metroLines() {
  const items = [];
  const cities = {};
  for (const [city, bbox] of Object.entries(METRO_CITIES)) {
    const q = `[out:json][timeout:120];(rel${TRANSIT_ROUTE}["name"~"${METRO_NAME}",i](${bbox});rel${TRANSIT_ROUTE}["network"~"${METRO_NAME}",i](${bbox});rel${TRANSIT_ROUTE}["operator"~"${METRO_OPERATOR}",i](${bbox});)->.r;(.r;node(r.r);way(r.r)["public_transport"];way(r.r)["railway"="platform"];way(r.r)["highway"="platform"];rel(br.r)["type"="route_master"];);out body center;`;
    let els;
    try {
      els = await overpass(q);
    } catch (e) {
      console.error(`  ${city}: FAILED (${e.message})`);
      cities[city] = { bbox, failed: true };
      continue;
    }
    const lines = pickLines(els, city);
    // what OSM had, for review: every candidate relation name, so a missing line can be traced
    const candidates = [...new Set(els.filter((e) => e.type === 'relation' && e.tags?.type === 'route').map((e) => e.tags.name).filter(Boolean))].sort();
    cities[city] = { bbox, lines: lines.map((l) => `${l.name} (${l.stations.length})`), candidates };
    for (const r of els.filter((e) => e.type === 'relation' && e.tags?.type === 'route')) console.log(`    ${describeRoute(r, els)}`);
    items.push(...lines);
    console.log(`  ${city}: ${lines.length} lines; candidates: ${candidates.join(' | ') || 'none'}`);
    await sleep(2000);
  }
  return { items, query: `per city: rel${TRANSIT_ROUTE}[name|network ~ ${METRO_NAME}]`, cities };
}

const jobs = {
  orangeline: () => routeStops({ filter: '["route"~"^(subway|light_rail|train)$"]["name"~"Orange",i]', line: 'orangeline', code: 'OL' }),
  metrobus: () => routeStops({ filter: '["route"="bus"]["name"~"Metro ?bus",i]["name"!~"feeder",i]', line: 'metrobus', code: 'MB' }),
  hospitals: () => poi('["amenity"="hospital"]', 'hospital'),
  fuel: () => poi('["amenity"="fuel"]', 'fuel'),
  lines: metroLines
};

// Refuse to overwrite good data with a suspiciously small result (a partial or failed query)
const MIN = { orangeline: 10, metrobus: 10, hospitals: 10, fuel: 10, lines: 1 };

await mkdir(OUT, { recursive: true });
// OSM_ONLY=lines,metrobus fetches just those; a dataset that fails keeps its previous file and the run fails at the end.
const only = (process.env.OSM_ONLY ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const failed = [];
for (const [name, job] of Object.entries(jobs)) {
  if (only.length && !only.includes(name)) continue;
  try {
    const { items, query, ...extra } = await job();
    if (items.length < MIN[name]) throw new Error(`only ${items.length} items (expected at least ${MIN[name]}); not writing`);
    await writeFile(new URL(`${name}.json`, OUT), JSON.stringify(withMeta(items, { fetchedAt, bbox: extra.cities ? null : BBOX, query, ...extra }), null, 1) + '\n');
    console.log(`${name}: ${items.length} items${extra.relationName ? ` (${extra.relationName})` : ''}`);
  } catch (e) {
    console.error(`${name}: FAILED, previous file kept (${e.message})`);
    failed.push(name);
  }
  await new Promise((r) => setTimeout(r, 2000)); // be polite to the public server
}
if (failed.length) console.error(`::warning::OSM datasets not refreshed: ${failed.join(', ')}`);

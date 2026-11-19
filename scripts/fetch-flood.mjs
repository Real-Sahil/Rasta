#!/usr/bin/env node
// Satellite-detected flood extents (UNOSAT, via HDX) clipped to the Lahore region -> src/data/flood/lahore.json.
// Needs network + `unzip` + GDAL's `ogr2ogr` (apt gdal-bin; the workflow installs it). Run: npm run data:flood
// Licence: CC BY-SA (UNOSAT). Credit is shown in the app; share-alike applies to the derived layer.
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clipAndSimplify } from './lib/flood.mjs';

const BBOX = [73.6, 30.9, 75.0, 31.9]; // west,south,east,north: greater Lahore
const DATASETS = [
  'satellite-detected-flood-extent-in-punjab-province-pakistan-10-july-2025',
  'satellite-detected-water-extents-from-26-august-to-7-september-2025-over-pakistan'
];
const OUT = new URL('../src/data/flood/', import.meta.url);

const work = await (await import('node:fs/promises')).mkdtemp(join(tmpdir(), 'flood-'));
const events = [];

for (const id of DATASETS) {
  const meta = (await (await fetch(`https://data.humdata.org/api/3/action/package_show?id=${id}`)).json()).result;
  const res = meta.resources.find((r) => /shp/i.test(r.format));
  if (!res) { console.warn(`${id}: no shapefile resource, skipped`); continue; }
  console.log(`${meta.title}: downloading ${res.download_url}`);
  const zip = join(work, `${id.slice(0, 20)}.zip`);
  const r = await fetch(res.download_url, { headers: { 'user-agent': 'buraq-pakistan-data-build/1.0' } });
  if (!r.ok) throw new Error(`download ${r.status}`);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(zip));
  const dir = join(work, id.slice(0, 20));
  execFileSync('unzip', ['-q', '-o', zip, '-d', dir]);

  const all = [];
  const walk = async (d) => { for (const e of await readdir(d, { withFileTypes: true })) { const p = join(d, e.name); e.isDirectory() ? await walk(p) : all.push(p); } };
  await walk(dir);
  // Only the detected-flood layers: skip analysis extents, cloud masks and permanent-water baselines.
  const shps = all.filter((p) => /FloodExtent.*\.shp$/i.test(p));
  console.log(`  flood layers: ${shps.map((p) => p.replace(dir, '')).join(', ')}`);

  const polygons = [];
  for (const [i, shp] of shps.entries()) {
    // ogr2ogr filters to the region with the spatial index and reprojects to WGS84, so we never parse the full national file in JS.
    const geo = join(work, `${id.slice(0, 20)}-${i}.geojson`);
    execFileSync('ogr2ogr', ['-f', 'GeoJSON', '-t_srs', 'EPSG:4326', '-spat', ...BBOX.map(String), '-spat_srs', 'EPSG:4326', geo, shp], { stdio: 'inherit', maxBuffer: 1 << 28 });
    const feats = JSON.parse(await readFile(geo, 'utf8')).features;
    const clipped = clipAndSimplify(feats, { bbox: BBOX });
    console.log(`  ${shp.split('/').pop()}: ${feats.length} features in region -> ${clipped.length} polygons kept`);
    polygons.push(...clipped);
  }
  const range = /\[(\d{4}-\d{2}-\d{2})/.exec(meta.dataset_date ?? '');
  events.push({
    id,
    title: meta.title,
    satelliteDate: range ? range[1] : null,
    source: meta.dataset_source ?? null,
    licence: meta.license_title ?? null,
    url: `https://data.humdata.org/dataset/${id}`,
    polygons // each polygon is an array of rings of [lon,lat]
  });
}

await mkdir(OUT, { recursive: true });
const doc = {
  _meta: {
    source: 'UNOSAT satellite-detected flood extents via the Humanitarian Data Exchange',
    licence: 'CC BY-SA (check each event). Credit UNOSAT; derived layers must stay share-alike.',
    fetchedAt: new Date().toISOString(),
    clipBbox: BBOX,
    note: 'Historical satellite detections only. NOT a live or forecast flood layer. Simplified to ~30 m; empty polygons means no detected flooding in this region for that event.'
  },
  events
};
await writeFile(new URL('lahore.json', OUT), JSON.stringify(doc));
console.log(`wrote lahore.json (${events.map((e) => `${e.satelliteDate}: ${e.polygons.length} polygons`).join('; ')})`);

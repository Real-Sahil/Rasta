#!/usr/bin/env node
// Satellite-detected flood extents (UNOSAT, via HDX) clipped to the Lahore region -> src/data/flood/lahore.json.
// Needs network + `unzip` + GDAL's `ogr2ogr` (apt gdal-bin; the workflow installs it). Run: npm run data:flood
// Licence: CC BY-SA (UNOSAT). Credit is shown in the app; share-alike applies to the derived layer.
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clipAndSimplify } from './lib/flood.mjs';

const BBOX = [74.0, 31.3, 74.7, 31.75]; // west,south,east,north: Lahore district area
const SIMPLIFY = { tol: 0.0005, minArea: 5e-6, decimals: 4 }; // ~55 m tolerance, drop fragments under ~2.5 ha
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
    // Newline-delimited output, simplified and attribute-free by GDAL, read line by line: the raw regional layer is hundreds of MB.
    const geo = join(work, `${id.slice(0, 20)}-${i}.geojsonl`);
    execFileSync('ogr2ogr', ['-f', 'GeoJSONSeq', '-t_srs', 'EPSG:4326', '-spat', ...BBOX.map(String), '-spat_srs', 'EPSG:4326', '-select', '', '-explodecollections', '-lco', 'COORDINATE_PRECISION=5', geo, shp], { stdio: 'inherit' });
    let seen = 0;
    const clipped = [];
    for await (const line of createInterface({ input: createReadStream(geo), crlfDelay: Infinity })) {
      if (!line.trim()) continue;
      seen++;
      clipped.push(...clipAndSimplify([JSON.parse(line)], { bbox: BBOX, ...SIMPLIFY }));
    }
    console.log(`  ${shp.split('/').pop()}: ${seen} features in region -> ${clipped.length} polygons kept`);
    polygons.push(...clipped);
  }
  const range = /\[(\d{4}-\d{2}-\d{2})/.exec(meta.dataset_date ?? '');
  events.push({
    id,
    title: meta.title,
    // HDX dataset date (publication/analysis date). The exact satellite pass dates are in the title, not guessed here.
    datasetDate: range ? range[1] : null,
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
    note: 'Historical satellite detections only. NOT a live or forecast flood layer. Simplified to ~55 m and small fragments dropped. An empty polygon list means no detected flooding in this area for that event.'
  },
  events
};
await writeFile(new URL('lahore.json', OUT), JSON.stringify(doc));
console.log(`wrote lahore.json (${events.map((e) => `${e.datasetDate}: ${e.polygons.length} polygons`).join('; ')})`);

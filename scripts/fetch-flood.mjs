#!/usr/bin/env node
// Satellite-detected flood extents (UNOSAT, via HDX) clipped to the Lahore region -> src/data/flood/lahore.json.
// Needs network + `unzip` + the `shapefile` package (CI installs it with --no-save). Run: npm run data:flood
// Licence: CC BY-SA (UNOSAT). Credit is shown in the app; share-alike applies to the derived layer.
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clipAndSimplify, isWgs84Prj } from './lib/flood.mjs';

const BBOX = [73.6, 30.9, 75.0, 31.9]; // west,south,east,north: greater Lahore
const DATASETS = [
  'satellite-detected-flood-extent-in-punjab-province-pakistan-10-july-2025',
  'satellite-detected-water-extents-from-26-august-to-7-september-2025-over-pakistan'
];
const OUT = new URL('../src/data/flood/', import.meta.url);
const { open } = await import('shapefile');

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
  const shps = all.filter((p) => /\.shp$/i.test(p));
  console.log(`  shapefiles: ${shps.map((p) => p.replace(dir, '')).join(', ')}`);

  const polygons = [];
  for (const shp of shps) {
    const prj = all.find((p) => p.toLowerCase() === shp.replace(/\.shp$/i, '.prj').toLowerCase());
    if (!prj || !isWgs84Prj(await readFile(prj, 'utf8'))) { console.warn(`  skip ${shp}: projection missing or not WGS84`); continue; }
    const src = await open(shp);
    const feats = [];
    for (let x = await src.read(); !x.done; x = await src.read()) feats.push(x.value);
    const clipped = clipAndSimplify(feats, { bbox: BBOX });
    console.log(`  ${shp.split('/').pop()}: ${feats.length} features -> ${clipped.length} polygons in region`);
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

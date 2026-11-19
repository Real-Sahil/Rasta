// Copies the OSM extracts the app bundles. Run from the repo root: node mobile/tool/sync_osm.mjs
import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('mobile/assets/osm', { recursive: true });
for (const f of ['hospitals', 'fuel']) copyFileSync(`src/data/osm/${f}.json`, `mobile/assets/osm/${f}.json`);
console.log('synced');

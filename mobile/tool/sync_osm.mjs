// Copies the OSM and flood extracts the app bundles. Run from the repo root: node mobile/tool/sync_osm.mjs
import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('mobile/assets/osm', { recursive: true });
mkdirSync('mobile/assets/flood', { recursive: true });
for (const f of ['hospitals', 'fuel', 'metrobus', 'orangeline']) copyFileSync(`src/data/osm/${f}.json`, `mobile/assets/osm/${f}.json`);
copyFileSync('src/data/flood/lahore.json', 'mobile/assets/flood/lahore.json');
console.log('synced');

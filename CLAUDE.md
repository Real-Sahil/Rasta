# Buraq Pakistan – project guide

Pakistan-first mobility PWA (React 19 + Vite 8 + Tailwind 4 + MapLibre GL). Client-only: there is no backend.

## Commands
- `npm install` – plain install works (no `--legacy-peer-deps` needed; lockfile is `package-lock.json`).
- `npm run dev` – dev server on :3000.
- `npm run lint` – `tsc --noEmit` (must stay at zero errors).
- `npm test` – Vitest unit tests (`src/**/*.test.ts`).
- `npm run build` – production build + service worker.
- `npm run check` – lint + test + build (what CI runs).

## Layout
- `src/App.tsx` – app shell: GPS, routing (OSRM + offline estimate), incidents, tabs.
- `src/services/` – pure logic (GPS manager, navigation engine, fares, speech, storage, AQI/weather, helpers). Put testable logic here, with a `*.test.ts` beside it.
- `src/components/` – UI. `MapLibreProviderAdapter` is the live map; `OsmMapView` is the no-WebGL fallback.
- `src/data/` – locales (en/ur/pa/ar must keep identical keys) and Lahore location/transit data.

## Rules learned the hard way
- **Never fabricate data.** No `Math.random()` for AQI/weather/votes, no invented phone numbers, ratings, "verified/official" labels, or fake progress. If real data is unavailable, show nothing or say so.
- `userLocation` is `null` until a real GPS fix. Never default to a Lahore coordinate for the user, SOS, or incident reports.
- Route ids must include destination and travel mode, otherwise a stale route object survives a destination change.
- Escape every untrusted string put into HTML (`escapeHtml` in `src/services/escapeHtml.ts`); map markers/popups use `innerHTML`/`setHTML`.
- Keep `route`/`markers` props to the map memoised; new object identities re-run map effects every render.
- Public OSRM only has a car profile; walking uses the FOSSGIS foot server.
- Add every new UI string to all four locales and provide Urdu text for RTL.
- Third-party calls (Nominatim, OSRM, Open-Meteo, ArcGIS/OpenFreeMap tiles) send coordinates/queries off-device; don't claim otherwise in the privacy copy.

## Known gaps (not yet fixed)
Voice search re-initialises on each render; app-level voice mute isn't wired to speech; off-route detection is vertex-based; ETA/remaining distance in the HUD are route totals; PWA icons are 1376×768 images declared as 192/512.

## Hooks
`.claude/settings.json` installs deps on remote session start and runs a typecheck after edits to `src/**/*.ts(x)`.

# Buraq Pakistan – project guide

Pakistan-first mobility PWA (React 19 + Vite 8 + Tailwind 4 + MapLibre GL). Client-only: there is no backend.

## Commands
- `npm install` – plain install works (no `--legacy-peer-deps` needed; lockfile is `package-lock.json`).
- `npm run dev` – dev server on :3000.
- `npm run lint` – `tsc --noEmit` (must stay at zero errors).
- `npm test` – Vitest unit tests (`src/**/*.test.ts`).
- `npm run build` – production build + service worker.
- `npm run check` – lint + test + build (what CI runs).

## Architecture
- `src/core/` – **all navigation logic, UI-free and unit-tested**: `geo` (haversine/bearing/projection), `routeMatcher` (true segment matching with a progress window), `navigation` (pure `createSession`/`updateSession`: progress, remaining distance/ETA, step, off-route after 3 fixes, arrival), `announcer` (500/200/50 m prompts, once each), `routing` (OSRM parse/validate + labelled offline estimate), `store` (Zustand: fix, destination, routes, session, reroute, mute; request-sequencing so stale route responses are discarded).
- `src/hooks/` – thin adapters: `useGpsTracking` (GPS → store), `useRoutePlanner` (reload routes on destination/mode/~200 m start change, frozen mid-trip), `useVoiceAnnouncer` (store announcements → speech, honours mute, works on any tab).
- `src/App.tsx` – view state + layout only. Never put routing/GPS/navigation logic back in components.
- `src/services/` – GPS manager, speech, fares, storage, Open-Meteo AQI/weather, incident sync.
- `src/components/` – UI. `MapLibreProviderAdapter` is the live map; `OsmMapView` is the no-WebGL fallback.
- `src/data/` – locales (en/ur/pa/ar must keep identical keys) and Lahore location/transit data.

Tests: pure logic in `src/core` and `src/services` is covered by Vitest. For UI flows, drive the built app with Playwright using `serviceWorkers: 'block'` (the PWA service worker otherwise bypasses `page.route` mocks) and move simulated GPS in realistic hops (the GPS glitch filter rejects jumps over 1.2 km in under 2 s).

## Backend (Vercel Function + Neon Postgres)
- `api/index.ts` is the whole API (one self-contained file, no relative imports so it deploys on any Vercel runtime): `POST ?op=session`, `GET ?op=list`, `POST ?op=create`, `POST ?op=act` (confirm/flag). Logic takes an injected `db`; tests (`api/api.test.ts`) run it against the real migration on PGlite.
- Schema: `db/migrations/*.sql` (applied once each, in order, by `scripts/migrate.mjs`, which runs before `vite build` and skips when `DATABASE_URL` is unset). Add new numbered files; never edit an applied one.
- Identity: anonymous, stateless HMAC-signed device token (`SESSION_SECRET`, else derived from `DATABASE_URL`). The database itself enforces: content limits, Pakistan bounding box, server-controlled counters/expiry (≤ 6 h), 10 reports/h per device and 30/h per IP hash, one confirmation per device, no confirming your own report, 3 flags hide a report.
- Credibility = 50 + 5 per independent confirmation (max 95). No realtime on Neon: the client polls every 20 s while the tab is visible.
- Client: `src/services/incidentsApi.ts`. If `/api` isn't reachable (plain `npm run dev`, no function) the app falls back to device-only reports. To test the API locally use `vercel dev` with the Neon env vars.
- Known limits: per-IP limits are generous because mobile carriers share IPs; the anonymous token can be re-minted, so rate limits and flags are friction, not identity. Moderation of hidden reports is manual SQL for now.

## Data from OpenStreetMap
`npm run data:osm` (or the "Refresh OSM data" workflow) writes `src/data/osm/*.json` from Overpass with source/licence/date metadata. Unknown values are `null`, never guessed (e.g. no machine-made Urdu names). ODbL: keep the OpenStreetMap attribution in the app. The hand-typed station lists in `src/data/pakistanLocations.ts` are known to be partly wrong; replace them with the OSM output once generated.

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
Incidents are device-local (no backend, so no real community sharing or moderation); transit station list is incomplete and fares are estimates; no transit routing; PWA icons are 1376×768 images declared as 192/512; offline map packs and offline routing don't exist; main JS bundle is a single ~1.5 MB chunk; no Playwright suite in CI yet.

## Hooks
`.claude/settings.json` installs deps on remote session start and runs a typecheck after edits to `src/**/*.ts(x)`.

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

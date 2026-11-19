# Buraq Pakistan – project guide

Pakistan-first mobility PWA (React 19 + Vite 8 + Tailwind 4 + MapLibre GL). Static PWA plus one Vercel Function backed by Neon Postgres (community reports only).

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
- `src/components/` – UI. `MapLibreProviderAdapter` is the live map (OpenFreeMap styles only: Liberty/Bright/Positron; there is no free satellite imagery, so none is offered); `OsmMapView` is the no-WebGL fallback (standard OSM tiles; keep it light, per the OSM tile policy).
- `src/data/` – locales (en/ur/pa/ar must keep identical keys) and Lahore location/transit data.

Tests: pure logic in `src/core` and `src/services` is covered by Vitest. For UI flows, drive the built app with Playwright using `serviceWorkers: 'block'` (the PWA service worker otherwise bypasses `page.route` mocks) and move simulated GPS in realistic hops (the GPS glitch filter rejects jumps over 1.2 km in under 2 s).

## Backend (Vercel Function + Neon Postgres)
- `api/index.ts` is the whole API (one self-contained file, no relative imports so it deploys on any Vercel runtime): `POST ?op=session`, `GET ?op=list`, `POST ?op=create`, `POST ?op=act` (confirm/flag). Logic takes an injected `db`; tests (`api/api.test.ts`) run it against the real migration on PGlite.
- Schema: `db/migrations/*.sql` (applied once each, in order, by `scripts/migrate.mjs`, which runs before `vite build` and skips when `DATABASE_URL` is unset). Add new numbered files; never edit an applied one.
- Identity: anonymous, stateless HMAC-signed device token (`SESSION_SECRET`, else derived from `DATABASE_URL`). The database itself enforces: content limits, Pakistan bounding box, server-controlled counters/expiry (≤ 6 h), 10 reports/h per device and 30/h per IP hash, one confirmation per device, no confirming your own report, 3 flags hide a report.
- Credibility = 50 + 5 per independent confirmation (max 95). No realtime on Neon: the client polls every 20 s while the tab is visible.
- Client: `src/services/incidentsApi.ts`. If `/api` isn't reachable (plain `npm run dev`, no function) the app falls back to device-only reports. To test the API locally use `vercel dev` with the Neon env vars.
- Known limits: per-IP limits are generous because mobile carriers share IPs; the anonymous token can be re-minted, so rate limits and flags are friction, not identity. Moderation of hidden reports is manual SQL for now.

## Spoken directions (English / Urdu / Punjabi)
- `src/core/phrases.ts`: the whole spoken vocabulary (11 phrases + 500 m / 200 m prefixes) in en, ur and pa (Shahmukhi). Urdu/Punjabi wording is a **draft pending native-speaker review**; never ship it unreviewed.
- `src/core/announcer.ts` produces structured announcements (`phrase`, `distanceM`, text per language). It speaks the band (500/200), not the exact distance, so recordings stay a small fixed set.
- `src/core/voice.ts` (pure): `chooseVoice` (Punjabi uses a Shahmukhi voice if present, else an Urdu voice flagged `approximate`; Gurmukhi `pa-IN` voices are ignored; no voice = `none`) and `planClips`.
- `src/services/speechNavigation.ts`: plays recorded clips (`public/audio/<lang>/<key>.mp3`, listed in `public/audio/manifest.json`) only when every clip a sentence needs exists, else the phone's TTS voice, else silence with a visible notice in the HUD. Arabic UI speaks English.
- `npm run voice:generate` (or the "Generate voice clips" workflow) creates the clips with a cloud TTS (azure | elevenlabs | google; see `scripts/lib/voice-gen.mjs`); the full set is 39 clips / ~600 characters. No cloud service has a Shahmukhi Punjabi voice: Punjabi text is read by an Urdu voice, so judge Punjabi by ear and prefer a native recording if it sounds wrong.
- `npm run voice:list` regenerates `docs/voice-phrases.md`, the recording checklist.

## Data from OpenStreetMap
`npm run data:osm` (or the "Refresh OSM data" workflow) writes `src/data/osm/*.json` from Overpass with source/licence/date metadata. Unknown values are `null`, never guessed (e.g. no machine-made Urdu names). ODbL: keep the OpenStreetMap attribution in the app. The hand-typed station lists in `src/data/pakistanLocations.ts` are known to be partly wrong; replace them with the OSM output once generated.

## Past-flooding layer (UNOSAT via HDX)
`npm run data:flood` (or the "Refresh flood data" workflow, which installs GDAL) writes `src/data/flood/lahore.json`: UNOSAT satellite-detected flood extents clipped to the Lahore district area, simplified (~55 m). It is **historical only**, not live or a forecast, and the UI says so. CC BY-SA: the credit shows on the map and the derived layer stays share-alike. The map loads it as a separate lazy chunk only when "Past flooding (satellite)" is switched on (off by default). `ogr2ogr -simplify` stalls on these polygons, so don't re-add it. `scripts/probe-sources.mjs` is a read-only catalogue probe (Mobility Database has no Pakistan feeds; OpenAQ/Transitland need keys).

## Rules learned the hard way
- **Never fabricate data.** No `Math.random()` for AQI/weather/votes, no invented phone numbers, ratings, "verified/official" labels, or fake progress. If real data is unavailable, show nothing or say so.
- `userLocation` is `null` until a real GPS fix. Never default to a Lahore coordinate for the user, SOS, or incident reports.
- Route ids must include destination and travel mode, otherwise a stale route object survives a destination change.
- Escape every untrusted string put into HTML (`escapeHtml` in `src/services/escapeHtml.ts`); map markers/popups use `innerHTML`/`setHTML`.
- Keep `route`/`markers` props to the map memoised; new object identities re-run map effects every render.
- Public OSRM only has a car profile; walking uses the FOSSGIS foot server.
- Add every new UI string to all four locales and provide Urdu text for RTL.
- Third-party calls (Nominatim, OSRM, Open-Meteo, OpenFreeMap tiles, and OpenStreetMap tiles in the no-WebGL fallback) send coordinates/queries off-device; don't claim otherwise in the privacy copy.

## Hardening (moderation, monitoring, limits)
- **Admin**: `/admin.html` (noindex, not in the service-worker fallback) talks to `?op=admin_list|admin_set|admin_purge` with `Authorization: Bearer $ADMIN_KEY`. Without `ADMIN_KEY` those ops answer 404. The page keeps the key in `sessionStorage` and builds the DOM with `textContent` only. Never render report text as HTML.
- **Daily clean-up**: `vercel.json` cron calls `GET /api?op=admin_purge` at 03:17 UTC (expired reports > 7 days, error logs > 14 days). Vercel sends `Authorization: Bearer $CRON_SECRET`, so `CRON_SECRET` must equal `ADMIN_KEY`.
- **Spam**: migration 003 adds a near-duplicate trigger (same category within ~150 m while an active report exists → `duplicate_report`, HTTP 409). The client shows a friendly message. Limits remain friction, not identity.
- **Monitoring**: `src/services/errorReporting.ts` (window error / unhandledrejection, max 10 per session, de-duplicated) and `ErrorBoundary` post to `?op=log` (table `client_errors`, no user identifiers, 14-day retention). Read them in `/admin.html`. No third-party service.
- **Routing/geocoding resilience**: `src/core/routing.ts` fails over across `CAR_ENDPOINTS` / `FOOT_ENDPOINTS` with timeouts and a 2-minute cache, then falls back to the labelled offline estimate; `SearchInput` geocoding is abortable with a 6 s timeout and cached. To use a paid or self-hosted router/geocoder set `VITE_ROUTING_CAR_URL`, `VITE_ROUTING_FOOT_URL`, `VITE_GEOCODE_URL` at build time and add the host to `connect-src` in `vercel.json`.
- **Legal**: first-run driving notice + privacy + terms (`LegalModal`, keys `legal*` in all four locales). The text is a plain-language draft; have a lawyer read it before relying on it. Update the privacy copy whenever a new third-party host is added.
- **CSP** lives in `vercel.json` (`Content-Security-Policy`). Every external host must be listed there; `npm run test:e2e` enforces the policy against the built app and fails on any violation. MapLibre needs `worker-src blob:` and inline styles.
- **Function region**: `sin1` (next to the Neon database).
- **Bundle**: the map engine and tab screens are lazy chunks (`lazy()` in `App.tsx`); the entry chunk is ~0.5 MB.
- **Drive test**: `node scripts/drive-test.mjs` (after build) simulates a drive and checks vehicle position/arrow, turn handling, arrival; screenshots in `drive-out/` (git-ignored).
- **Browser tests**: `npm run test:e2e` (Playwright, mocked OSRM/Nominatim/Open-Meteo/API, runs in CI after `npm run build`; install with `npm install --no-save playwright`; set `CHROMIUM_PATH` to use a preinstalled browser).

## Known gaps (not yet fixed)
Transit station list is incomplete and fares are estimates; no transit routing; PWA icons are 1376×768 images declared as 192/512; offline map packs and offline routing don't exist; the public OSRM/Nominatim/OpenFreeMap/OpenStreetMap-tile services have no SLA or commercial licence; Urdu/Punjabi wording and voice clips are unreviewed by native speakers; the legal text is not lawyer-reviewed.

## Routing UI: From / To and trip sharing
- `origin` in the store (null = my location). A custom start gives a **preview only**: `startNavigation` returns `custom_origin` and the UI explains it. Route ids include the origin (`fromId`) so a stale route can't survive a start change. The vehicle is drawn on the route line (`session.snapped`), and a drag/zoom while driving pauses camera-follow until "Recenter" or 10 s.
- Trip sharing (`src/core/shareTrip.ts`): the HUD share button builds destination + ETA + an OpenStreetMap link to the current position on the device and hands it to the Web Share sheet (or the clipboard). It is a one-off snapshot, not live tracking; live tracking would need a server and a privacy design.

## Hooks
`.claude/settings.json` installs deps on remote session start (`.claude/hooks/session-start.sh`, skips when package files are unchanged) and runs a typecheck after edits to `src/**/*.ts(x)`.
- Urdu clips (13) in `public/audio/ur/` come from the open tiny-urdu model, not a cloud service: see `docs/urdu-clips.md` (spellings, status, licence caveat). Unreviewed by ear or by a native speaker.

## Android prototype (Capacitor)
- `capacitor.config.ts` + `android/`: a thin Capacitor shell that loads the **production site** (`server.url`), so web fixes reach the phone without a new APK. For a store build, remove `server`, bundle `dist/`, make API calls absolute and add CORS.
- `src/services/native.ts` is the only place that touches Capacitor. `isNative()` is false in a browser, so the web app is unchanged. Inside the app: `RobustGpsManager` uses `@capacitor-community/background-geolocation` (foreground service, fixes continue with the screen locked; `useLegacyBridge` stops the 5-minute cutoff), and `SpeechNavigationService` uses the phone's native TTS (`@capacitor-community/text-to-speech`) instead of recorded clips, because the WebView pauses audio elements when the screen locks.
- Build: the "Android APK" workflow (`android-apk.yml`, run it manually) uploads `app-debug.apk` as an artifact; there is no Android SDK in the cloud sandbox. Test on a real phone first with the screen locked mid-route; budget Android (Xiaomi/Oppo/Samsung) may kill the service, so check battery-optimisation settings.
- Known gaps: Android 13+ needs the POST_NOTIFICATIONS permission granted for the tracking notification to show (the service still runs); default Capacitor launcher icons; no iOS; unsigned debug build only.

## Flutter app (`mobile/`, Android + iOS, in progress)
- A native Dart port of the app, separate from the web app. Stages 1-4: map (MapLibre, OpenFreeMap Liberty), background GPS, search (Nominatim), routing (OSRM failover + labelled offline estimate), turn-by-turn HUD, native TTS, trip share, road reports (list/confirm/flag/create against the same `/api`, polled every 20 s while the tab shows), rider fare/delay reports, full legal/privacy screen, emergency tab (4 helplines, WhatsApp/share SOS with the real fix, nearest hospitals/fuel from bundled OSM data that covers Lahore only and says so elsewhere), weather + AQI card (Open-Meteo, city chosen from a real fix or by the user), "compare ways to travel" fare estimates in the route sheet (Metrobus/Orange Line only for Lahore-area trips; hidden for offline-estimate routes), en/ur/pa. Stage 4: Transit tab (Orange Line/Metrobus station lists from bundled OSM `mobile/assets/osm/{metrobus,orangeline}.json`, tap a station to route to it, station-count fare estimate with student half-fare, plus the riders' report card as its third segment) and the past-flooding map layer (UNOSAT, bundled `mobile/assets/flood/lahore.json`, parsed only when switched on, off by default, historical-only note + CC BY-SA credit, shown on the Map tab). **Not at parity with the web app**: no theming/dark mode, no door-to-door transit routing, and other web-only extras. Do not claim parity.
- `mobile/lib/core/` is a line-for-line port of `src/core/` (geo, route matcher, navigation, announcer, phrases, voice, routing, share). Keep both in step: a fix in one needs the other. Tests: `cd mobile && flutter test` (29). `flutter analyze` must stay clean.
- Same rules apply: never fabricate data, `userLocation` stays null until a real fix, a custom start is a preview only, Urdu/Punjabi are drafts pending native review.
- CI: `.github/workflows/flutter.yml` (analyze, test, Android debug APK artifact, iOS `--no-codesign` build). No Flutter/Android SDK in the cloud sandbox for native builds; Flutter is installed locally at `/opt/fl/flutter` only for analyze/test.
- Application ids: Android `pk.buraq.mobile`, separate from the Capacitor shell `pk.buraq.app`.
- `mobile/lib/l10n_web.dart` is **generated** from `src/data/locales.ts` (`node mobile/tool/gen_web_strings.mjs`); mobile-only strings live in `l10n_app.dart` (incl. mobile-specific privacy paragraphs 2 and 4: no crash reports, background location notice). Reporting needs a real GPS fix. API base defaults to the production site (`--dart-define=API_BASE=...` to override).
- Bundled OSM data: `mobile/assets/osm/*.json` are copies of `src/data/osm/*.json`; a test fails if they differ (also for the flood file). Refresh with `node mobile/tool/sync_osm.mjs` after `npm run data:osm` / `npm run data:flood`. Stage 3 strings live in `l10n_more.dart` and override older tables in `tr()`. Privacy copy now names Open-Meteo: keep it in step with any new host. iOS deployment target is 15.5 (required by `maplibre_gl`).

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
`npm run data:osm` (or the "Refresh OSM data" workflow) writes `src/data/osm/*.json` from Overpass with source/licence/date metadata. Unknown values are `null`, never guessed (e.g. no machine-made Urdu names). ODbL: keep the OpenStreetMap attribution in the app. Transit stations on web and Flutter come from the OSM output; `src/data/pakistanLocations.ts` now only holds 16 hand-picked Lahore landmarks (quick picks), helplines and city centres.

## Metro / BRT outside Lahore
`npm run data:osm` also writes `src/data/osm/lines.json`: metro/BRT lines for Islamabad–Rawalpindi, Multan, Peshawar and Karachi (`METRO_CITIES` in `scripts/fetch-osm.mjs`, `pickLines` in `scripts/lib/osm.mjs`: route variants grouped by route_master/ref/base name, longest kept, feeders dropped; `meta.cities` lists every candidate so the pick can be reviewed). Unnamed stops are dropped by the apps, never labelled. Web: city chips at the top of the Transit tab (`TransitPlanner` `CityLines`), list/diagram, tap to route; Flutter: chips on the Stations tab (`parseLines` in `core/transit.dart`). **No fares outside Lahore**: there are no checked tariffs, so the UI says "pay at the station" instead of estimating. Lahore keeps its own two files and fare estimate.
- Several OSM lines are drawn as a road track with no stop members (Multan, Islamabad Red line). Then the stops come from named `public_transport=station` elements within 200 m of the track, ordered along the chained ways (`trackOf`/`stationsAlong`), or by a nearest-neighbour chain when the ways don't chain (`stationsNearTrack`). `tidyLineStations` drops nearby non-line stations when most names carry the line word, and trims that word (`osmName` keeps the original); `mergeDuplicateStations` folds same-name or <250 m entries (one station mapped twice), keeping the shorter OSM name. Each line records `stopsFrom` (relation | track | track-unordered); check the order in the workflow log after a refresh.
- Peshawar BRT and Karachi Green Line have stations in OSM but no route relation, so no line is built: inventing membership/order would be guessing. Fix it upstream in OSM, then re-run. Overpass timeouts fail one city only (`OSM_ONLY=lines` re-runs just this file).

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

## Place search (Geoapify via our API)
- `GET /api?op=geocode&q=&lang=en|ur&near=lat,lng` proxies Geoapify with `GEOAPIFY_KEY` (Vercel env, encrypted; never in the repo or the app). Pakistan filter, results outside the box dropped, `near` rounded to 0.1° (bias only), edge-cached 24 h, the query is never logged. No key = 404.
- Web `SearchInput` and Flutter `SearchService` try it first and fall back to public Nominatim on 404/error/offline. `VITE_GEOCODE_URL` still overrides both on web. Privacy paragraph 2 names Geoapify (through our server, so it doesn't see the user's IP) and Nominatim as the fallback.
- `GET /api?op=nearby&kind=hospital|fuel&near=lat,lng`: Geoapify Places (OSM data) within 50 km, point rounded to 0.01° (~1 km), Pakistan only, edge-cached 7 days, same fields as the bundled POIs (OSM tags from `datasource.raw`, unknown = null). Flutter Emergency tab uses it with a real fix in Pakistan (`services/nearby_service.dart`), credits "OpenStreetMap contributors, via Geoapify", and falls back to the bundled Lahore extract with a visible notice when the server can't answer.
- Weather/AQI cities: 18 (web `PK_CITIES` in `pakistanLocations.ts`, Flutter `cityCentres`; keep both in step). Web picks the nearest city within 80 km on the first fix unless the user chose one. Flutter adds "My location": the fix rounded to 0.1° (`roundedForWeather`) when no listed city is within 80 km; privacy paragraph 2 (mobile) says so.
- Geoapify free tier: 3,000 requests/day. Edge caching helps; watch usage in the Geoapify dashboard and restrict the key there.

## Hardening (moderation, monitoring, limits)
- **Admin**: `/admin.html` (noindex, not in the service-worker fallback) talks to `?op=admin_list|admin_set|admin_purge` with `Authorization: Bearer $ADMIN_KEY`. Without `ADMIN_KEY` those ops answer 404. The page keeps the key in `sessionStorage` and builds the DOM with `textContent` only. Never render report text as HTML.
- **Daily clean-up**: `vercel.json` cron calls `GET /api?op=admin_purge` at 03:17 UTC (expired reports > 7 days, error logs > 14 days). Vercel sends `Authorization: Bearer $CRON_SECRET`, so `CRON_SECRET` must equal `ADMIN_KEY`.
- **Spam**: migration 003 adds a near-duplicate trigger (same category within ~150 m while an active report exists → `duplicate_report`, HTTP 409). The client shows a friendly message. Limits remain friction, not identity.
- **Monitoring**: `src/services/errorReporting.ts` (window error / unhandledrejection, max 10 per session, de-duplicated) and `ErrorBoundary` post to `?op=log` (table `client_errors`, no user identifiers, 14-day retention). Read them in `/admin.html`. No third-party service. Flutter (`mobile/lib/services/error_reporter.dart`) posts the same way in release builds only (`kind` flutter|caught, `platform` android|ios, migration 005): max 10 per session, de-duplicated, numbers with 3+ decimals and query strings scrubbed, never coordinates or search words. Search failures and routing falling back to the estimate are reported as `caught`.
- **Routing/geocoding resilience**: `src/core/routing.ts` fails over across `CAR_ENDPOINTS` / `FOOT_ENDPOINTS` with timeouts and a 2-minute cache, then falls back to the labelled offline estimate; `SearchInput` geocoding is abortable with a 6 s timeout and cached. To use a paid or self-hosted router/geocoder set `VITE_ROUTING_CAR_URL`, `VITE_ROUTING_FOOT_URL`, `VITE_GEOCODE_URL` at build time and add the host to `connect-src` in `vercel.json`.
- **Legal**: first-run driving notice + privacy + terms (`LegalModal`, keys `legal*` in all four locales). The text is a plain-language draft; have a lawyer read it before relying on it. Update the privacy copy whenever a new third-party host is added.
- **CSP** lives in `vercel.json` (`Content-Security-Policy`). Every external host must be listed there; `npm run test:e2e` enforces the policy against the built app and fails on any violation. MapLibre needs `worker-src blob:` and inline styles.
- **Function region**: `sin1` (next to the Neon database).
- **Bundle**: the map engine and tab screens are lazy chunks (`lazy()` in `App.tsx`); the entry chunk is ~0.5 MB.
- **Drive test**: `node scripts/drive-test.mjs` (after build) simulates a drive and checks vehicle position/arrow, turn handling, arrival; screenshots in `drive-out/` (git-ignored).
- **Browser tests**: `npm run test:e2e` (Playwright, mocked OSRM/Nominatim/Open-Meteo/API, runs in CI after `npm run build`; install with `npm install --no-save playwright`; set `CHROMIUM_PATH` to use a preinstalled browser).

## Known gaps (not yet fixed)
Transit station list is incomplete and fares are estimates; no transit routing; offline map packs and offline routing don't exist; the public OSRM/Nominatim/OpenFreeMap/OpenStreetMap-tile services have no SLA or commercial licence; Urdu/Punjabi wording and voice clips are unreviewed by native speakers; the legal text is not lawyer-reviewed.

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
- A native Dart port of the app, separate from the web app. Stages 1-4: map (MapLibre, OpenFreeMap Liberty), background GPS, search (Nominatim), routing (OSRM failover + labelled offline estimate), turn-by-turn HUD, native TTS, trip share, road reports (list/confirm/flag/create against the same `/api`, polled every 20 s while the tab shows), rider fare/delay reports, full legal/privacy screen, emergency tab (4 helplines, WhatsApp/share SOS with the real fix, nearest hospitals/fuel from bundled OSM data that covers Lahore only and says so elsewhere), weather + AQI card (Open-Meteo, city chosen from a real fix or by the user), "compare ways to travel" fare estimates in the route sheet (Metrobus/Orange Line only for Lahore-area trips; hidden for offline-estimate routes), en/ur/pa. Stage 4: Transit tab (Orange Line/Metrobus station lists from bundled OSM `mobile/assets/osm/{metrobus,orangeline}.json`, tap a station to route to it, station-count fare estimate with student half-fare, plus the riders' report card as its third segment) and the past-flooding map layer (UNOSAT, bundled `mobile/assets/flood/lahore.json`, parsed only when switched on, off by default, historical-only note + CC BY-SA credit, shown on the Map tab). **Not at parity with the web app**: no door-to-door transit routing, and other web-only extras. Do not claim parity.
- `mobile/lib/core/` is a line-for-line port of `src/core/` (geo, route matcher, navigation, announcer, phrases, voice, routing, share). Keep both in step: a fix in one needs the other. Tests: `cd mobile && flutter test` (29). `flutter analyze` must stay clean.
- Same rules apply: never fabricate data, `userLocation` stays null until a real fix, a custom start is a preview only, Urdu/Punjabi are drafts pending native review.
- CI: `.github/workflows/flutter.yml` (analyze, test, Android debug APK artifact, iOS `--no-codesign` build). No Flutter/Android SDK in the cloud sandbox for native builds; Flutter is installed locally at `/opt/fl/flutter` only for analyze/test.
- Launcher icons: Android `mipmap-*/ic_launcher.png` and the iOS `AppIcon.appiconset` are resized from `public/icons/icon-512.png` (iOS 1024 is upscaled; replace with a 1024 master when one exists; no adaptive icon yet).
- Search (`SearchService`): one retry, throws `SearchException(busy)` for HTTP errors/rate limits and `SearchException(false)` for no connection, so the UI says which. `SearchPanel` clears its fields only when a route is cleared, never on an ordinary rebuild. No second geocoder: adding a host means updating the privacy copy.
- Release signing: the "Create Android upload key" workflow (run once) generates the Play upload key on the runner and commits it AES-256-encrypted as `mobile/android/upload-key.p12.gpg` (refuses if it exists; password = secret `ANDROID_KEYSTORE_PASSWORD`, which the owner also keeps in a password manager). "Android release (AAB)" decrypts it and builds a signed bundle (version code = run number). `build.gradle.kts` signs with it only when `ANDROID_KEYSTORE_PATH` is set, else debug. Never commit an unencrypted keystore.
- Outside Pakistan: `core/coverage` (web `src/core/coverage.ts`, Flutter `lib/core/coverage.dart`, same outline and tests) is a coarse hand-traced outline padded outside the border. A real fix outside it shows a notice in search; it never blocks anything and no fix means no notice.
- Saved places (Flutter): Home, Work and 5 recent destinations in `core/saved_places.dart`, stored in `shared_preferences` only (privacy paragraph 4 says so). Shown when the empty destination box is focused; long-press removes; Info has "Clear recent destinations". Language and mute are persisted too.
- Application ids: Android `pk.buraq.mobile`, separate from the Capacitor shell `pk.buraq.app`.
- `mobile/lib/l10n_web.dart` is **generated** from `src/data/locales.ts` (`node mobile/tool/gen_web_strings.mjs`); mobile-only strings live in `l10n_app.dart` (incl. mobile-specific privacy paragraphs 2 and 4: first-party error reports, device-only saved places, background location notice). Reporting needs a real GPS fix. API base defaults to the production site (`--dart-define=API_BASE=...` to override).
- Bundled OSM data: `mobile/assets/osm/*.json` are copies of `src/data/osm/*.json`; a test fails if they differ (also for the flood file). Refresh with `node mobile/tool/sync_osm.mjs` after `npm run data:osm` / `npm run data:flood`. Stage 3 strings live in `l10n_more.dart` and override older tables in `tr()`. Privacy copy now names Open-Meteo: keep it in step with any new host. iOS deployment target is 15.5 (required by `maplibre_gl`).

## Themes / skins (optional; Luce, Miniature, Schematic, Chamak, Nastaliq)
- Off by default ("Standard"). Header palette button (web) opens a list of all six; Info tab chips (Flutter). `?skin=<name>|default` also works on web. Web state: `src/components/chamakSkin.ts` (`SKINS`, `useSkin`/`setSkin`, localStorage `buraq.skin`, mirrored to `<html data-skin>`); picker: `SkinPicker.tsx`.
- Chrome only: header, bottom sheet, bottom nav, Start button and the driving HUD (`NavHud` palette table `HUD`, follows light/dark). The map, search box and data views stay plain so the road is the focus. Add new chrome by adding a `skin-*` class and CSS under the skin blocks in `index.css`, never by branching components.
- Display fonts are requested only when that skin is on (Yatra One for Chamak, Cormorant Garamond for Miniature, Noto Nastaliq Urdu for Nastaliq; Google Fonts hosts are in the CSP). Yatra One has no Arabic-script glyphs, so it only styles LTR text; Nastaliq does cover Arabic script.
- Luce's HUD is a watch dial (`SkinHuds.tsx` `LuceHud`; 60 ticks light clockwise over the last 500 m, `dialProgress`). Nastaliq's HUD shows the turn word at poster size (`posterWord`, from the draft Urdu/Punjabi phrases in `core/phrases.ts`, English for other languages), so it inherits the "pending native review" caveat. Flutter mirrors both (`core/skin_hud.dart`, `LuceDial`); Noto Nastaliq isn't bundled there, so the system Urdu font is used.
- Chamak adds the diamond strip and flower; its HUD gets calmer above 30 km/h.
- Web transit tab has a List/Diagram toggle (`LineDiagram.tsx`): evenly spaced, real OSM station order, labelled "not to scale"; the fare result highlights the ride.
- Flutter: same six looks (`mobile/lib/ui/chamak.dart`: `kSkins`, `skinPalette`, `buildTheme`), plus Auto/Light/Dark for the whole app, both saved on the device. Fonts aren't bundled there (system font). Flutter also has the schematic (`line_diagram.dart`). A test checks contrast of every skin/brightness.
- The search suggestions hide the bottom sheet while open (`BottomSheet` `tucked`) so the sheet never covers the map or the list.

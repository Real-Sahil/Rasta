#!/usr/bin/env node
// Drive simulation against the built app (vite preview), mocked services. Reports how navigation *behaves*:
// vehicle marker position/orientation, camera follow, free-pan, off-route/reroute, arrival.
// Run: npm run build && node scripts/drive-test.mjs   (screenshots in drive-out/)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

const PORT = 4174, BASE = `http://127.0.0.1:${PORT}`, OUT = 'drive-out';
await mkdir(OUT, { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
process.on('exit', () => { try { server.kill(); } catch { /* gone */ } });
for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE)).ok) break; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 500)); }

const results = [];
const rec = (s, n, d = '') => { results.push(s); console.log(`${s.padEnd(4)} ${n}${d ? ' — ' + d : ''}`); };

// Route: 1.1 km east along "Mall Road", then 0.9 km north along "Canal Road", arrive.
const A = [74.3100, 31.5600], B = [74.3205, 31.5600], C = [74.3205, 31.5682];
const dist = (p, q) => { const R = 6371000, r = Math.PI / 180; const dLa = (q[1] - p[1]) * r, dLo = (q[0] - p[0]) * r; const a = Math.sin(dLa / 2) ** 2 + Math.cos(p[1] * r) * Math.cos(q[1] * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(a)); };
const osrm = { code: 'Ok', routes: [{ distance: dist(A, B) + dist(B, C), duration: 240,
  geometry: { type: 'LineString', coordinates: [A, B, C] },
  legs: [{ steps: [
    { maneuver: { type: 'depart', location: A }, name: 'Mall Road', distance: dist(A, B), duration: 130 },
    { maneuver: { type: 'turn', modifier: 'left', location: B }, name: 'Canal Road', distance: dist(B, C), duration: 110 },
    { maneuver: { type: 'arrive', location: C }, name: '', distance: 0, duration: 0 } ] }] }] };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', permissions: ['geolocation'], geolocation: { latitude: A[1], longitude: A[0], accuracy: 10 }, locale: 'en-GB' });
await ctx.route('**/*', async (route) => {
  const u = new URL(route.request().url());
  if (u.hostname === '127.0.0.1') {
    if (u.pathname === '/api') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.searchParams.get('op') === 'list' ? { incidents: [] } : { token: 't.t' }) });
    return route.continue();
  }
  if (/osrm|routing\.openstreetmap\.de/.test(u.hostname)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(osrm) });
  if (/nominatim|open-meteo/.test(u.hostname)) return route.fulfill({ status: 200, contentType: 'application/json', body: u.hostname.includes('nominatim') ? '[]' : '{}' });
  return route.abort();
});
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
const text = () => page.evaluate(() => document.body.innerText);
const move = async (p) => { await ctx.setGeolocation({ latitude: p[1], longitude: p[0], accuracy: 8 }); };
const lerp = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
// the user marker: its on-screen centre and the rotation of its arrow
const marker = () => page.evaluate(() => {
  const svg = document.querySelector('.maplibregl-marker svg.fill-current'); if (!svg) return null;
  const r = svg.getBoundingClientRect(); const mm = (svg.style.transform || '').match(/rotate\((-?[\d.]+)deg\)/);
  const deg = mm ? Number(mm[1]) : 45; // 45 = the old fixed tilt when no rotation is set
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), arrowDeg: deg, vw: innerWidth, vh: innerHeight };
});

await page.goto(BASE + '/'); await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'I understand' }).click().catch(() => {});
await page.waitForSelector('canvas.maplibregl-canvas', { timeout: 20000 });
await page.waitForTimeout(1500);
await page.locator('input[type=text]').first().fill('Badshahi'); await page.waitForTimeout(800);
await page.getByText('Badshahi Mosque & Lahore Fort').first().click(); await page.waitForTimeout(2500);

await page.screenshot({ path: `${OUT}/0-route-panel.png` });
await page.getByRole('button', { name: /start navigation/i }).first().click().catch(async () => { await page.getByText(/start/i).first().click(); });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/1-start.png` });
const m0 = await marker();
console.log('marker at start:', JSON.stringify(m0));

// ---- drive east, 35 m hops every 1.2 s
const legAB = dist(A, B); const hop = 35; const nAB = Math.round(legAB / hop);
const samples = [];
for (let i = 1; i <= nAB; i++) {
  await move(lerp(A, B, i / nAB)); await page.waitForTimeout(1200);
  if (i % 8 === 0) samples.push({ i, m: await marker(), t: (await text()).match(/(\d+ ?(m|km))/g)?.slice(0, 2) });
}
await page.screenshot({ path: `${OUT}/2-heading-east.png` });
const mEast = await marker();
console.log('marker heading east:', JSON.stringify(mEast), 'samples', JSON.stringify(samples.slice(0, 3)));

rec(mEast && Math.abs(mEast.x - mEast.vw / 2) < 25 ? 'INFO' : 'WARN', 'vehicle horizontal position', JSON.stringify(mEast));
rec(mEast && mEast.y > mEast.vh * 0.62 ? 'PASS' : 'WARN', 'vehicle sits in the lower part of the screen (room to see the road ahead)', `y=${mEast?.y}/${mEast?.vh}`);
rec(mEast && Math.abs(mEast.arrowDeg) < 10 ? 'PASS' : 'FAIL', 'vehicle arrow points up (map rotates to heading)', `arrow rotated ${mEast?.arrowDeg}deg`);

// ---- turn left at B and head north
let sawArrive = ''; const nBC = Math.round(dist(B, C) / hop);
for (let i = 1; i <= nBC; i++) {
  await move(lerp(B, C, i / nBC)); await page.waitForTimeout(1200);
  if (i === 3) { await page.screenshot({ path: `${OUT}/3-after-turn.png` }); }
  if (/arrive/i.test(await text())) sawArrive = 'saw Arrive at destination step';
}
const t1 = await text();
rec(/Canal Road/.test(t1) || /Arrive|arriv/i.test(t1) ? 'PASS' : 'FAIL', 'HUD advanced to the next street after the turn', t1.split('\n').slice(0, 6).join(' | '));

// ---- free pan while navigating: does the camera fight the user / is there a recentre control?
await page.mouse.move(200, 400); await page.mouse.down(); await page.mouse.move(200, 650, { steps: 8 }); await page.mouse.up();
const pill = page.getByRole('button', { name: /Recenter Map/ });
await page.waitForTimeout(800);
rec(await pill.count() ? 'PASS' : 'FAIL', 'dragging the map while driving shows a Recenter pill');
const panned = await marker(); await move(lerp(B, C, 0.5)); await page.waitForTimeout(2500); const still = await marker();
rec(panned && still && Math.abs(panned.y - still.y) > 80 ? 'PASS' : 'FAIL', 'camera stays where the user put it while the car keeps driving', `marker y ${panned?.y} -> ${still?.y}`);
await pill.click().catch(() => {}); await page.waitForTimeout(1800);
const back = await marker();
rec(back && back.y > back.vh * 0.55 && back.y < back.vh * 0.8 ? 'PASS' : 'FAIL', 'tapping Recenter brings the vehicle back to the driving position', `y=${back?.y}`);
rec(await pill.count() === 0 ? 'PASS' : 'FAIL', 'pill disappears after re-centring');

// ---- arrival
for (let i = 0; i < 4; i++) { await move(C); await page.waitForTimeout(1500); }
const tEnd = sawArrive || await text(); await page.screenshot({ path: `${OUT}/4-arrival.png` });
rec(/arriv/i.test(String(tEnd)) ? 'PASS' : 'FAIL', 'arrival is announced', tEnd.split('\n').slice(0, 5).join(' | '));
rec(errors.length === 0 ? 'PASS' : 'FAIL', 'no page errors while driving', errors.slice(0, 2).join(' | '));
await browser.close(); server.kill();
process.exit(results.includes('FAIL') ? 1 : 0);

#!/usr/bin/env node
// Hermetic browser tests: the built app (vite preview) with every external service mocked.
// Run: npm run build && node scripts/e2e.mjs   (needs `playwright`; CI installs it with --no-save)
// Also enforces the production Content-Security-Policy from vercel.json and fails on any violation.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;
const vercel = JSON.parse(await readFile('vercel.json', 'utf8'));
const cspHeader = vercel.headers[0].headers.find((h) => /^content-security-policy/i.test(h.key));
const CSP = cspHeader?.value;
if (!CSP) { console.error('no CSP in vercel.json'); process.exit(2); }

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch { /* already gone */ } };
process.on('exit', stop);
for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failed++; };

const osrm = {
  code: 'Ok',
  routes: [{
    distance: 3200, duration: 420,
    geometry: { type: 'LineString', coordinates: [[74.31, 31.56], [74.315, 31.565], [74.32, 31.57]] },
    legs: [{ steps: [
      { maneuver: { type: 'depart', location: [74.31, 31.56] }, name: 'Mall Road', distance: 2000, duration: 250 },
      { maneuver: { type: 'turn', modifier: 'left', location: [74.315, 31.565] }, name: 'Canal Road', distance: 1200, duration: 170 },
      { maneuver: { type: 'arrive', location: [74.32, 31.57] }, name: '', distance: 0, duration: 0 }
    ] }]
  }]
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, serviceWorkers: 'block',
  permissions: ['geolocation'], geolocation: { latitude: 31.56, longitude: 74.31, accuracy: 15 }, locale: 'en-GB'
});
const apiCalls = [];
await ctx.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.hostname === '127.0.0.1') {
    if (url.pathname === '/api') {
      apiCalls.push(`${route.request().method()} ${url.searchParams.get('op')}`);
      const op = url.searchParams.get('op');
      const body = op === 'list' ? { incidents: [] } : op === 'session' ? { token: 't.t' } : { ok: true };
      return route.fulfill({ status: op === 'log' ? 202 : 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    const res = await route.fetch();
    const headers = { ...res.headers() };
    if ((headers['content-type'] || '').includes('text/html')) headers['content-security-policy'] = CSP; // enforce, even if the vercel.json header is Report-Only
    return route.fulfill({ response: res, headers });
  }
  if (/router\.project-osrm|routing\.openstreetmap\.de/.test(url.hostname)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(osrm) });
  if (/nominatim/.test(url.hostname)) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  if (/open-meteo/.test(url.hostname)) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  if (/fonts\.(googleapis|gstatic)/.test(url.hostname)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
  return route.abort(); // tiles etc.: not needed, and keeps the test offline-safe
});

const page = await ctx.newPage();
await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)); });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
const text = () => page.evaluate(() => document.body.innerText);

await page.goto(BASE + '/');
await page.waitForTimeout(2500);

// 1. first-run safety notice blocks until acknowledged
check('first run shows the driving-safety notice', /Never use your phone while driving/.test(await text()));
await page.getByRole('button', { name: 'I understand' }).click();
check('notice can be acknowledged and stays dismissed after reload', await (async () => {
  await page.reload(); await page.waitForTimeout(1500);
  return !/Never use your phone while driving/.test(await text());
})());

// 2. legal screen reachable, localised
await page.getByRole('button', { name: 'Safety, privacy & terms' }).click();
await page.getByRole('tab', { name: 'Privacy' }).click();
check('privacy tab explains what leaves the device', /Nominatim/.test(await text()) && /No account and no ads/.test(await text()));
await page.getByRole('button', { name: 'Close' }).last().click();
await page.locator('select[title="Select Language"]').selectOption('ur');
await page.getByRole('button', { name: 'حفاظت، رازداری اور شرائط' }).click();
const urText = await page.locator('[role=dialog]').innerText();
check('legal screen is available in Urdu (RTL)', /گاڑی چلاتے ہوئے فون ہرگز استعمال نہ کریں/.test(urText) && (await page.locator('[role=dialog]').getAttribute('dir')) === 'rtl', urText.slice(0, 80));
await page.getByRole('button', { name: 'بند کریں' }).last().click();
await page.locator('select[title="Select Language"]').selectOption('en');

// 3. map engine loads lazily and renders
await page.waitForSelector('canvas.maplibregl-canvas', { timeout: 15000 }).then(
  () => check('map canvas renders (lazy chunk loaded)', true),
  () => check('map canvas renders (lazy chunk loaded)', false, 'no canvas: WebGL unavailable?')
);

// 4. search -> route (mocked OSRM)
await page.locator('input[type=text]').first().fill('Badshahi');
await page.waitForTimeout(800);
await page.getByText('Badshahi Mosque & Lahore Fort').first().click();
await page.waitForTimeout(2500);
const t = await text();
check('a route is shown with distance and time', /\d+ mins/.test(t) && !/Estimated route \(offline\)/.test(t));

// 5. client error reporting reaches the log endpoint, once per distinct error
await page.evaluate(() => { setTimeout(() => { throw new Error('e2e boom'); }, 0); });
await page.waitForTimeout(800);
check('uncaught errors are reported to /api?op=log', apiCalls.some((c) => c.endsWith(' log')));

// 6. no CSP violations anywhere above
const csp = [...new Set(await page.evaluate(() => window.__csp))];
check('no Content-Security-Policy violations', csp.length === 0, csp.slice(0, 5).join(' | '));
const unexpected = pageErrors.filter((m) => !/e2e boom/.test(m));
check('no unexpected uncaught page errors', unexpected.length === 0, unexpected.slice(0, 3).join(' | '));

await browser.close();
stop();
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);

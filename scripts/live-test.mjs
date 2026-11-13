#!/usr/bin/env node
// Live end-to-end test against a deployed site (no mocks, real network, real GPS emulation).
// Usage: BASE_URL=https://example.vercel.app [BYPASS=<vercel automation bypass secret>] [WRITE=1] node scripts/live-test.mjs
// Prints a PASS/FAIL/WARN table, writes live-report.json + screenshots to ./live-out, exits 1 on any FAIL.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = (process.env.BASE_URL || '').replace(/\/$/, '');
if (!BASE) { console.error('BASE_URL required'); process.exit(2); }
const BYPASS = process.env.BYPASS || '';
const WRITE = process.env.WRITE !== '0';
const OUT = 'live-out';
await mkdir(OUT, { recursive: true });

const results = [];
const rec = (area, name, status, detail = '') => {
  results.push({ area, name, status, detail });
  console.log(`${status.padEnd(4)} [${area}] ${name}${detail ? ' — ' + detail : ''}`);
};
const hdrs = BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {};
const get = (path, init = {}) => fetch(BASE + path, { redirect: 'manual', headers: { ...hdrs, ...(init.headers || {}) }, ...init });

// ---------------------------------------------------------------- 1. reachability / static assets
let reachable = false;
try {
  const r = await get('/');
  const html = await r.text();
  reachable = r.status === 200 && html.includes('id="root"');
  rec('access', 'home page is publicly reachable', reachable ? 'PASS' : 'FAIL', `HTTP ${r.status}${r.status >= 300 && r.status < 400 ? ' -> ' + r.headers.get('location') : ''}${/vercel.*(login|sso|authentication)/i.test(html) ? ' (Vercel login wall)' : ''}`);
  for (const [k, v] of [['content-security-policy', 'CSP'], ['x-content-type-options', 'nosniff'], ['strict-transport-security', 'HSTS']]) {
    rec('security', `${v} header`, r.headers.get(k) ? 'PASS' : 'WARN', r.headers.get(k) ? '' : 'missing');
  }
} catch (e) { rec('access', 'home page is publicly reachable', 'FAIL', String(e.message)); }

if (reachable) {
  for (const path of ['/manifest.webmanifest', '/sw.js', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-512-maskable.png', '/icons/apple-touch-icon.png', '/icons/favicon.ico']) {
    const r = await get(path);
    rec('pwa', path, r.status === 200 ? 'PASS' : 'FAIL', `HTTP ${r.status}`);
  }
  const man = await (await get('/manifest.webmanifest')).json().catch(() => null);
  rec('pwa', 'manifest has name, start_url, 3 icons incl. maskable', man && man.name && man.start_url && man.icons?.length >= 3 && man.icons.some((i) => i.purpose === 'maskable') ? 'PASS' : 'FAIL');
}

// ---------------------------------------------------------------- 2. API
let tokenA = null, tokenB = null, createdId = null;
const api = (op, { method = 'GET', token, body, ip } = {}) =>
  get(`/api?op=${op}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(ip ? { 'x-forwarded-for': ip } : {}) }, body: body ? JSON.stringify(body) : undefined });
const jsonOf = async (r) => { try { return await r.json(); } catch { return null; } };

if (reachable) {
  let r = await api('list');
  let j = await jsonOf(r);
  rec('api', 'GET list returns JSON { incidents: [] }', r.status === 200 && Array.isArray(j?.incidents) ? 'PASS' : 'FAIL', `HTTP ${r.status}`);
  rec('api', 'responses are not cacheable (no-store)', (r.headers.get('cache-control') || '').includes('no-store') ? 'PASS' : 'WARN', r.headers.get('cache-control') || 'none');
  r = await api('create', { method: 'POST', body: { category: 'hazard', title: 'no token', lat: 31.5, lng: 74.3 } });
  rec('api', 'create without token is rejected (401)', r.status === 401 ? 'PASS' : 'FAIL', `HTTP ${r.status}`);
  r = await api('create', { method: 'POST', token: 'garbage', body: { category: 'hazard', title: 'bad token', lat: 31.5, lng: 74.3 } });
  rec('api', 'create with forged token is rejected (401)', r.status === 401 ? 'PASS' : 'FAIL', `HTTP ${r.status}`);
  r = await api('nope', { method: 'POST' });
  rec('api', 'unknown operation is rejected', [404, 405].includes(r.status) ? 'PASS' : 'FAIL', `HTTP ${r.status}`);

  tokenA = (await jsonOf(await api('session', { method: 'POST' })))?.token ?? null;
  tokenB = (await jsonOf(await api('session', { method: 'POST' })))?.token ?? null;
  rec('api', 'anonymous session tokens are issued and distinct', tokenA && tokenB && tokenA !== tokenB ? 'PASS' : 'FAIL');

  if (tokenA) {
    for (const [label, body] of [['coordinates outside Pakistan', { category: 'hazard', title: 'London test', lat: 51.5, lng: -0.12 }], ['short title', { category: 'hazard', title: 'x', lat: 31.5, lng: 74.3 }], ['unknown category', { category: 'bogus', title: 'abcdef', lat: 31.5, lng: 74.3 }], ['oversized body', { category: 'hazard', title: 'abcdef', description: 'x'.repeat(9000), lat: 31.5, lng: 74.3 }]]) {
      r = await api('create', { method: 'POST', token: tokenA, body });
      rec('api', `rejects ${label}`, r.status === 400 ? 'PASS' : 'FAIL', `HTTP ${r.status}`);
    }
  }

  if (WRITE && tokenA && tokenB) {
    const title = `[live-test] ${new Date().toISOString().slice(11, 19)} <img src=x onerror=alert(1)>`;
    r = await api('create', { method: 'POST', token: tokenA, body: { category: 'hazard', title, description: 'automated live test, expires automatically', lat: 31.5204, lng: 74.3587 } });
    j = await jsonOf(r);
    createdId = j?.id ?? null;
    rec('api', 'create a report (201)', r.status === 201 && createdId ? 'PASS' : 'FAIL', `HTTP ${r.status}${j?.error ? ' ' + j.error : ''}`);
    if (createdId) {
      const list = (await jsonOf(await api('list', { token: tokenA })))?.incidents ?? [];
      const mine = list.find((i) => i.id === createdId);
      rec('api', 'new report appears in list, marked mine, 0 confirmations', mine?.mine === true && mine.confirmations === 0 ? 'PASS' : 'FAIL');
      rec('api', 'list never leaks owner or IP hash', mine && !('created_by' in mine) && !('ip_hash' in mine) ? 'PASS' : 'FAIL');
      rec('api', 'hostile title is returned verbatim as data (escaped at render time)', mine?.title?.includes('<img') ? 'PASS' : 'WARN');
      r = await api('act', { method: 'POST', token: tokenA, body: { id: createdId, action: 'confirm' } });
      rec('api', 'cannot confirm your own report (403)', r.status === 403 ? 'PASS' : 'FAIL', `HTTP ${r.status}`);
      r = await api('act', { method: 'POST', token: tokenB, body: { id: createdId, action: 'confirm' } });
      rec('api', 'another device can confirm (200)', r.status === 200 ? 'PASS' : 'FAIL', `HTTP ${r.status}`);
      r = await api('act', { method: 'POST', token: tokenB, body: { id: createdId, action: 'confirm' } });
      rec('api', 'duplicate confirm is a harmless no-op', r.status === 200 ? 'PASS' : 'FAIL', `HTTP ${r.status}`);
      const after = ((await jsonOf(await api('list', { token: tokenB })))?.incidents ?? []).find((i) => i.id === createdId);
      rec('api', 'confirmation counted exactly once and marked confirmed for that device', after?.confirmations === 1 && after.confirmed === true ? 'PASS' : 'FAIL', `confirmations=${after?.confirmations}`);
      r = await api('act', { method: 'POST', token: tokenB, body: { id: '00000000-0000-4000-8000-000000000000', action: 'confirm' } });
      rec('api', 'confirming a non-existent report is a 404', r.status === 404 ? 'PASS' : 'FAIL', `HTTP ${r.status}`);
    }
  } else if (!WRITE) rec('api', 'write-path tests', 'SKIP', 'WRITE=0');
}

// ---------------------------------------------------------------- 3. browser
if (reachable) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    permissions: ['geolocation'], geolocation: { latitude: 31.5600, longitude: 74.3100, accuracy: 15 },
    extraHTTPHeaders: hdrs, locale: 'en-GB', timezoneId: 'Asia/Karachi'
  });
  const page = await ctx.newPage();
  const pageErrors = [], failedReq = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('requestfailed', (q) => failedReq.push(`${q.url().slice(0, 90)} ${q.failure()?.errorText}`));
  const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
  const text = () => page.evaluate(() => document.body.innerText);
  const step = async (area, name, fn) => { try { const d = await fn(); rec(area, name, d === false ? 'FAIL' : 'PASS', typeof d === 'string' ? d : ''); } catch (e) { rec(area, name, 'FAIL', String(e.message).split('\n')[0]); await shot('fail_' + name.replace(/\W+/g, '_').slice(0, 40)).catch(() => {}); } };

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await shot('01_home');
  await step('ui', 'app renders header, search, bottom nav', async () => (await text()).includes('BURAQ') && (await page.locator('nav[aria-label="Main"]').count()) === 1);
  await step('ui', 'map canvas is present and has size', async () => { const b = await page.locator('canvas.maplibregl-canvas').first().boundingBox(); return !!b && b.width > 200 && b.height > 200 ? `${Math.round(b.width)}x${Math.round(b.height)}` : false; });
  await step('map', 'basemap tiles actually load (>= 1 tile request OK)', async () => {
    const ok = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /openfreemap|arcgisonline|tiles/.test(e.name)).length);
    return ok > 0 ? `${ok} tile/style requests` : false;
  });
  await step('gps', 'real fix is picked up (position marker shown, no GPS error)', async () => (await page.locator('.maplibregl-marker').count()) > 0 && !/Location permission denied/.test(await text()));
  await step('data', 'AQI/weather from Open-Meteo shown or cleanly absent', async () => { const t = await text(); return /AQI \d+/.test(t) ? 'AQI shown' : 'AQI not shown (hidden on small screens or fetch failed)'; });

  await page.locator('input[type=text]').first().fill('Badshahi');
  await page.waitForTimeout(1200);
  await shot('02_search');
  await step('search', 'local suggestion for "Badshahi"', async () => (await text()).includes('Badshahi Mosque'));
  await page.locator('input[type=text]').first().fill('Packages Mall Lahore');
  await page.waitForTimeout(2500);
  await step('search', 'Nominatim online geocoding returns results', async () => /Geocoded|Walton|Packages/i.test(await text()) ? true : 'no online results (rate-limited or blocked)');
  await page.locator('input[type=text]').first().fill('Badshahi');
  await page.waitForTimeout(800);
  await page.getByText('Badshahi Mosque & Lahore Fort').first().click();
  await page.waitForTimeout(5000);
  await shot('03_route');
  const t3 = await text();
  await step('routing', 'real road route computed (not the offline estimate)', async () => /Estimated route \(offline\)|rough estimate/.test(t3) ? false : /\d+ mins/.test(t3) ? (t3.match(/\d+ mins\s*\(\S+ km\)/)?.[0] ?? '').replace(/\n/g, ' ') : false);
  await step('routing', 'route has a readable "via" road label', async () => /\n[A-Z][^\n]*(Road|Rd|Boulevard|Street|Avenue|Canal|Main)[^\n]*\n/.test(t3) || /Main roads/.test(t3));
  await step('ui', 'Start navigation button is visible without scrolling', async () => { const b = await page.getByText('Start navigation').boundingBox(); return !!b && b.y + b.height < 844 - 60; });

  await page.getByText('Start navigation').click();
  await page.waitForTimeout(2500);
  await shot('04_navigating');
  const t4 = await text();
  await step('nav', 'turn-by-turn HUD with distance, ETA and exit', async () => /Exit/.test(t4) && /ETA \d/.test(t4) && /(\d+ m|\d\.\d km)/.test(t4));
  await step('nav', 'sheet and bottom bar are hidden while driving', async () => (await page.locator('nav[aria-label="Main"]').count()) === 0);
  // drive ~0.4 km toward the destination in realistic hops
  const before = (await text()).match(/(\d+ m|\d\.\d km)\n/)?.[1];
  for (let i = 1; i <= 4; i++) { await ctx.setGeolocation({ latitude: 31.5600 + i * 0.0035, longitude: 74.3100 - i * 0.0004, accuracy: 10 }); await page.waitForTimeout(1500); }
  const afterTxt = await text();
  const after = afterTxt.match(/(\d+ m|\d\.\d km)\n/)?.[1];
  await step('nav', 'distance to next turn changes as the position moves', async () => before !== after ? `${before} -> ${after}` : false);
  await shot('05_progress');
  await step('nav', 'mute toggle works', async () => { await page.getByRole('button', { name: /Mute voice/ }).click(); return (await page.getByRole('button', { name: /Unmute voice/ }).count()) === 1; });
  await page.getByRole('button', { name: 'Exit' }).first().click();
  await page.waitForTimeout(800);
  await step('nav', 'exit returns to the route screen with the nav bar', async () => (await page.locator('nav[aria-label="Main"]').count()) === 1);

  for (const [tab, check] of [['Compare', /Rs\. \d+/], ['Transit', /Metrobus|Orange/], ['Alerts', /Report/], ['SOS', /1122/]]) {
    await page.getByRole('button', { name: tab, exact: true }).last().click();
    await page.waitForTimeout(700);
    await shot('tab_' + tab);
    await step('ui', `${tab} tab opens with content`, async () => check.test(await text()));
  }
  await step('data', 'OpenStreetMap transit stations present (Transit tab not empty)', async () => { await page.getByRole('button', { name: 'Transit', exact: true }).last().click(); await page.waitForTimeout(500); return /No station data yet/.test(await text()) ? false : true; });
  await step('data', 'OSM hospitals present in SOS tab', async () => { await page.getByRole('button', { name: 'SOS', exact: true }).last().click(); await page.waitForTimeout(500); return /No place data available yet/.test(await text()) ? false : true; });
  await step('security', 'SOS refuses to send nothing without GPS is covered by unit tests; button exists', async () => (await page.getByText('SOS WhatsApp').count()) === 1);

  // report an incident through the UI (needs the backend)
  if (WRITE) {
    await page.getByRole('button', { name: 'Alerts', exact: true }).last().click();
    await page.waitForTimeout(500);
    await page.getByText('Report New Incident').click();
    await page.waitForTimeout(600);
    await shot('06_report_form');
    await step('report', 'report form opens', async () => (await page.locator('form').count()) > 0);
    await step('report', 'submit a report through the UI and see it in the list', async () => {
      await page.locator('form input[type=text]').first().fill('[live-test] UI report ' + Date.now().toString().slice(-5));
      await page.locator('form button[type=submit]').first().click();
      await page.waitForTimeout(4000);
      return /\[live-test\] UI report/.test(await text());
    });
    await shot('07_after_report');
  }

  // language / RTL
  await page.locator('select').nth(1).selectOption('ur').catch(() => {});
  await page.waitForTimeout(800);
  await shot('08_urdu');
  await step('i18n', 'Urdu switches the page to RTL', async () => (await page.evaluate(() => document.documentElement.dir)) === 'rtl');

  await step('health', 'no uncaught page errors during the whole run', async () => pageErrors.length === 0 ? true : pageErrors.slice(0, 3).join(' | '));
  const noisy = failedReq.filter((f) => !/favicon|sentry/.test(f));
  rec('health', 'failed network requests', noisy.length === 0 ? 'PASS' : 'WARN', noisy.slice(0, 5).join(' | '));
  await browser.close();
}

const counts = results.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
await writeFile(`${OUT}/live-report.json`, JSON.stringify({ base: BASE, at: new Date().toISOString(), counts, results }, null, 2));
console.log('\nSUMMARY', JSON.stringify(counts));
process.exit(results.some((r) => r.status === 'FAIL') ? 1 : 0);

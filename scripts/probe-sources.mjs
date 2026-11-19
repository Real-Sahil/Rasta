#!/usr/bin/env node
// Read-only probe of public international data catalogues for Pakistan (no keys, nothing is written to the repo).
// Run on a GitHub runner via the "Probe data sources" workflow; prints what exists so we can decide what to import.
const get = async (url, opts = {}) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 45000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': 'buraq-pk-data-probe', ...(opts.headers || {}) } });
    return { ok: r.ok, status: r.status, text: opts.binary ? null : await r.text() };
  } catch (e) { return { ok: false, status: 0, text: String(e.message) }; } finally { clearTimeout(t); }
};
const h = (s) => console.log(`\n=== ${s}`);

h('Humanitarian Data Exchange (CKAN, no key)');
for (const q of ['pakistan health facilities', 'pakistan roads', 'pakistan flood extent', 'pakistan administrative boundaries']) {
  const r = await get(`https://data.humdata.org/api/3/action/package_search?rows=8&q=${encodeURIComponent(q)}&fq=groups:pak`);
  if (!r.ok) { console.log(`${q}: HTTP ${r.status} ${r.text.slice(0, 80)}`); continue; }
  const res = JSON.parse(r.text).result;
  console.log(`\n"${q}": ${res.count} datasets`);
  for (const d of res.results) console.log(` - ${d.title} | ${d.license_title || d.license_id || '?'} | updated ${String(d.metadata_modified).slice(0, 10)} | ${d.organization?.title ?? '?'} | https://data.humdata.org/dataset/${d.name}`);
}

h('Mobility Database catalogue (public CSV): Pakistan feeds');
{
  const r = await get('https://files.mobilitydatabase.org/feeds_v2.csv');
  if (!r.ok) console.log(`HTTP ${r.status} ${r.text.slice(0, 100)}`);
  else {
    const lines = r.text.split('\n');
    const head = lines[0];
    console.log(`catalogue rows: ${lines.length - 1}; columns: ${head.slice(0, 200)}`);
    const pk = lines.filter((l) => /,PK,|Pakistan|Lahore|Karachi|Islamabad|Rawalpindi/i.test(l));
    console.log(`rows mentioning Pakistan/major cities: ${pk.length}`);
    pk.slice(0, 10).forEach((l) => console.log(' - ' + l.slice(0, 260)));
  }
}

h('Copernicus EMS rapid-mapping activations mentioning Pakistan');
{
  const r = await get('https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations/?limit=2000&search=Pakistan');
  if (!r.ok) console.log(`HTTP ${r.status} ${r.text.slice(0, 100)}`);
  else {
    const j = JSON.parse(r.text);
    const rows = (j.results || j).filter?.((a) => /pakistan/i.test(JSON.stringify(a))) ?? [];
    console.log(`activations: ${rows.length}`);
    rows.slice(0, 12).forEach((a) => console.log(` - ${a.code ?? a.reference ?? ''} ${a.name ?? a.title ?? ''} ${String(a.eventTime ?? a.activationTime ?? '').slice(0, 10)}`));
  }
}

h('OpenAQ (needs a free API key; only checking that the host answers)');
{
  const r = await get('https://api.openaq.org/v3/countries?limit=1');
  console.log(`HTTP ${r.status} ${r.text.slice(0, 120)}`);
}

h('Transitland (needs a free API key; only checking that the host answers)');
{
  const r = await get('https://transit.land/api/v2/rest/agencies?search=Lahore&limit=3');
  console.log(`HTTP ${r.status} ${r.text.slice(0, 160)}`);
}

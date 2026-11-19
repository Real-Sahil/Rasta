// Pure helpers for turning Overpass JSON into app data. No network access here, so they are unit-testable.

/** Stops of a route relation in route order, using the relation's own member order. */
export function orderedStops(relation, elements) {
  const byKey = new Map(elements.filter((e) => e.type === 'node' || e.type === 'way').map((e) => [`${e.type}${e.id}`, e]));
  const seen = new Set();
  const out = [];
  for (const m of relation.members ?? []) {
    if ((m.type !== 'node' && m.type !== 'way') || !/^(stop|stop_entry_only|stop_exit_only|platform.*)?$/.test(m.role ?? '')) continue;
    if (m.type === 'way' && !/^platform/.test(m.role ?? '')) continue; // a way with an empty role is the road itself
    const e = byKey.get(`${m.type}${m.ref}`);
    const at = e?.type === 'way' ? e.center : e;
    if (!e || !at || !Number.isFinite(at.lat) || !Number.isFinite(at.lon)) continue;
    const name = e.tags?.name || e.tags?.['name:en'];
    if (!name || seen.has(name.trim().toLowerCase())) continue; // stop + platform of one station count once
    seen.add(name.trim().toLowerCase());
    out.push(e.type === 'way' ? { ...e, lat: at.lat, lon: at.lon } : e);
  }
  return out;
}

/** Why a route gave few stops: member counts by type/role and how many resolved with a name. For the refresh log. */
export function describeRoute(relation, elements) {
  const counts = {};
  for (const m of relation.members ?? []) counts[`${m.type}:${m.role || '-'}`] = (counts[`${m.type}:${m.role || '-'}`] ?? 0) + 1;
  return `${relation.tags?.name ?? relation.id} [${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ')}] named stops=${orderedStops(relation, elements).length}`;
}

const pick = (tags, ...keys) => keys.map((k) => tags?.[k]).find(Boolean);

export function toStation(node, index, line, code) {
  return {
    id: `${code.toLowerCase()}_${String(index + 1).padStart(2, '0')}`,
    code: `${code}${String(index + 1).padStart(2, '0')}`,
    name: pick(node.tags, 'name:en', 'name'),
    nameUrdu: pick(node.tags, 'name:ur') ?? null, // null means "no Urdu name in OSM": never machine-guess one
    line,
    lat: node.lat,
    lng: node.lon,
    osmId: `node/${node.id}`
  };
}

export function toPoi(el, kind) {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;
  const t = el.tags ?? {};
  const name = pick(t, 'name:en', 'name', 'brand', 'operator');
  if (!name) return null;
  return {
    id: `osm_${el.type}_${el.id}`,
    kind,
    name,
    nameUrdu: t['name:ur'] ?? null,
    lat,
    lng,
    address: [t['addr:housenumber'], t['addr:street'], t['addr:suburb'], t['addr:city']].filter(Boolean).join(', ') || null,
    phone: pick(t, 'phone', 'contact:phone') ?? null,
    open24h: t.opening_hours === '24/7' ? true : null, // null = unknown
    emergency: t.emergency === 'yes' ? true : null,
    osmId: `${el.type}/${el.id}`
  };
}

export const withMeta = (items, meta) => ({
  meta: {
    source: 'OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)',
    ...meta,
    count: items.length
  },
  items
});

/** Line name without the direction part OSM adds to each variant ("Green Line BRT: Surjani => Numaish" -> "Green Line BRT"). */
export const baseLineName = (name) => String(name ?? '').split(/\s*(?::|=>|→|->|⇒)\s*/)[0].trim();

const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

/**
 * Metro / BRT lines of one city from an Overpass result (route relations + their stop nodes + route_masters).
 * Variants of the same line (directions, short turns) are grouped by route_master, else by ref, else by base name;
 * the variant with the most named stops is kept. Feeder routes and lines with fewer than `minStops` are dropped.
 * Everything comes from OSM tags; missing values stay null.
 */
export function pickLines(elements, city, { minStops = 5 } = {}) {
  const routes = elements.filter((e) => e.type === 'relation' && e.tags?.type === 'route');
  const masters = elements.filter((e) => e.type === 'relation' && e.tags?.type === 'route_master');
  const masterOf = new Map();
  for (const m of masters) for (const mem of m.members ?? []) if (mem.type === 'relation') masterOf.set(mem.ref, m);
  const groups = new Map();
  for (const r of routes) {
    if (/feeder/i.test(r.tags?.name ?? '')) continue;
    const m = masterOf.get(r.id);
    const key = m ? `m${m.id}` : r.tags?.ref ? `ref:${r.tags.ref}` : `n:${baseLineName(r.tags?.name).toLowerCase()}`;
    const stops = orderedStops(r, elements);
    const g = groups.get(key);
    if (!g || stops.length > g.stops.length) groups.set(key, { r, m, stops });
  }
  const lines = [];
  const used = new Set();
  for (const { r, m, stops } of groups.values()) {
    if (stops.length < minStops) continue;
    const t = { ...(r.tags ?? {}), ...(m?.tags ?? {}) }; // master tags win (they name the line, not a direction)
    const name = baseLineName(pick(t, 'name:en', 'name') ?? r.tags?.ref);
    if (!name) continue;
    let id = `${city}_${slug(name)}`;
    for (let i = 2; used.has(id); i++) id = `${city}_${slug(name)}_${i}`;
    used.add(id);
    lines.push({
      id,
      city,
      name,
      nameUrdu: t['name:ur'] ? baseLineName(t['name:ur']) : null,
      ref: t.ref ?? null,
      colour: /^#[0-9a-f]{6}$/i.test(t.colour ?? '') ? t.colour : null,
      mode: r.tags?.route ?? null,
      operator: t.operator ?? null,
      relation: `relation/${r.id}`,
      stations: stops.map((n, i) => ({
        id: `${id}_${String(i + 1).padStart(2, '0')}`,
        name: pick(n.tags, 'name:en', 'name'),
        nameUrdu: n.tags?.['name:ur'] ?? null,
        line: id,
        lat: n.lat,
        lng: n.lon,
        osmId: `${n.type ?? 'node'}/${n.id}`
      }))
    });
  }
  return lines.sort((a, b) => a.name.localeCompare(b.name));
}

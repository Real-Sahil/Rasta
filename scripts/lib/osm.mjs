// Pure helpers for turning Overpass JSON into app data. No network access here, so they are unit-testable.

/** Stops of a route relation in route order, using the relation's own member order. */
export function orderedStops(relation, elements) {
  const nodes = new Map(elements.filter((e) => e.type === 'node').map((n) => [n.id, n]));
  const seen = new Set();
  const out = [];
  for (const m of relation.members ?? []) {
    if (m.type !== 'node' || !/^(stop|stop_entry_only|stop_exit_only|platform.*)?$/.test(m.role ?? '')) continue;
    const n = nodes.get(m.ref);
    if (!n || seen.has(n.id)) continue;
    const name = n.tags?.name || n.tags?.['name:en'];
    if (!name) continue;
    seen.add(n.id);
    out.push(n);
  }
  return out;
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

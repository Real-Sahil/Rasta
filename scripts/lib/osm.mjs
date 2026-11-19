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


// --- Lines drawn as a track only (no stop members): stations are matched to the track geometry. ---
const M_PER_DEG = 111_320;
const toXY = (lat0) => (p) => [p.lon * M_PER_DEG * Math.cos((lat0 * Math.PI) / 180), p.lat * M_PER_DEG];
const where = (e) => (e.type === 'way' || e.type === 'relation' ? e.center : e);

/**
 * The route's way members chained into one polyline (member order, each way flipped to connect).
 * Returns null when the chain has more than `maxGaps` breaks over 300 m: then the order along it can't be trusted.
 */
export function trackOf(relation, { maxGaps = 2 } = {}) {
  const ways = (relation.members ?? []).filter((m) => m.type === 'way' && !/platform/.test(m.role ?? '') && m.geometry?.length >= 2);
  if (!ways.length) return null;
  const lat0 = ways[0].geometry[0].lat;
  const xy = toXY(lat0);
  const d = (a, b) => Math.hypot(xy(a)[0] - xy(b)[0], xy(a)[1] - xy(b)[1]);
  let line = [...ways[0].geometry];
  if (ways[1]) {
    const g = ways[1].geometry, first = line[0], last = line[line.length - 1];
    const near = (p) => Math.min(d(p, g[0]), d(p, g[g.length - 1]));
    if (near(first) < near(last)) line.reverse();
  }
  let gaps = 0;
  for (const w of ways.slice(1)) {
    const end = line[line.length - 1];
    let g = w.geometry;
    if (d(end, g[g.length - 1]) < d(end, g[0])) g = [...g].reverse();
    if (d(end, g[0]) > 300) gaps++;
    line = line.concat(g);
  }
  return gaps > maxGaps ? null : line;
}

/** Stations within `maxM` of the track, ordered by distance along it; one per name (the closest). */
export function stationsAlong(track, candidates, { maxM = 200 } = {}) {
  if (!track || track.length < 2) return [];
  const xy = toXY(track[0].lat);
  const pts = track.map(xy);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const best = new Map();
  for (const c of candidates) {
    const at = where(c);
    const name = c.tags?.name || c.tags?.['name:en'];
    if (!name || !at || !Number.isFinite(at.lat) || !Number.isFinite(at.lon)) continue;
    const [px, py] = xy(at);
    let off = Infinity, along = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const L2 = (bx - ax) ** 2 + (by - ay) ** 2;
      const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / L2)) : 0;
      const dd = Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
      if (dd < off) { off = dd; along = cum[i - 1] + t * Math.sqrt(L2); }
    }
    if (off > maxM) continue;
    const key = name.trim().toLowerCase();
    const prev = best.get(key);
    if (!prev || off < prev.off) best.set(key, { e: { ...c, lat: at.lat, lon: at.lon }, off, along });
  }
  return [...best.values()].sort((a, b) => a.along - b.along).map((x) => x.e);
}

/** Every vertex of the route's road ways, unordered: enough to tell which stations sit on the line. */
export const trackPoints = (relation) =>
  (relation.members ?? []).filter((m) => m.type === 'way' && !/platform/.test(m.role ?? '')).flatMap((m) => m.geometry ?? []);

/**
 * Stations within `maxM` of an unordered track, ordered by a nearest-neighbour chain from one end of the line
 * (the end of the farthest-apart pair). Used only when the ways can't be chained; good for a single line, not a loop.
 */
export function stationsNearTrack(points, candidates, { maxM = 200 } = {}) {
  if (!points.length) return [];
  const xy = toXY(points[0].lat);
  const P = points.map(xy);
  const best = new Map();
  for (const c of candidates) {
    const at = where(c);
    const name = c.tags?.name || c.tags?.['name:en'];
    if (!name || !at || !Number.isFinite(at.lat)) continue;
    const [x, y] = xy(at);
    let off = Infinity;
    for (const [px, py] of P) off = Math.min(off, Math.hypot(px - x, py - y));
    if (off > maxM) continue;
    const key = name.trim().toLowerCase();
    if (!best.has(key) || off < best.get(key).off) best.set(key, { e: { ...c, lat: at.lat, lon: at.lon }, off, p: [x, y] });
  }
  const left = [...best.values()];
  if (left.length < 2) return left.map((x) => x.e);
  const dist = (a, b) => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1]);
  let start = left[0], far = 0;
  for (const a of left) for (const b of left) if (dist(a, b) > far) { far = dist(a, b); start = a; }
  const out = [start];
  left.splice(left.indexOf(start), 1);
  while (left.length) {
    const last = out[out.length - 1];
    let k = 0;
    for (let i = 1; i < left.length; i++) if (dist(last, left[i]) < dist(last, left[k])) k = i;
    out.push(left.splice(k, 1)[0]);
  }
  return out.map((x) => x.e);
}

// Words OSM mappers add to every station of a line ("Gulgasht Metrobus", "Metro Bus Terminal Faizabad").
const LINE_WORDS = /\b(metro\s*bus\s*(terminal|station|stop)|metro\s*(station|stop)|metro\s*bus|metrobus|brt\s*(station|stop))\b/i;

/**
 * Keep only the stations that carry the line's own word when most of them do (drops a nearby bus stand),
 * and show the name without that repeated word. The OSM name is kept as `osmName`.
 */
export function tidyLineStations(stations) {
  const named = stations.map((e) => ({ e, name: e.tags?.['name:en'] || e.tags?.name || '' }));
  const tagged = named.filter((x) => LINE_WORDS.test(x.name));
  const keep = tagged.length >= Math.max(3, named.length * 0.6) ? tagged : named;
  const cut = (n) => n.replace(LINE_WORDS, ' ').replace(/^\s*station\s+|\s+station\s*$/i, ' ').replace(/\s*[-–]\s*$|^\s*[-–]\s*/g, '').replace(/\s+/g, ' ').trim() || n;
  return keep.map(({ e, name }) => ({
    ...e,
    tags: { ...e.tags, ...(e.tags?.name ? { name: cut(e.tags.name) } : {}), ...(e.tags?.['name:en'] ? { 'name:en': cut(e.tags['name:en']) } : {}) },
    osmName: name
  }));
}

/**
 * One entry per real station: OSM often maps a station twice (node + platform, or two spellings a few metres apart).
 * In line order, a station with a name already seen, or within `maxM` of the previous kept one, is merged into it;
 * the shorter name wins ("Saddar station" + "Saddar" -> "Saddar"). Nothing is renamed beyond picking an OSM name.
 */
const metres = (a, b) => { const xy = toXY(a.lat); const [x1, y1] = xy(a), [x2, y2] = xy(b); return Math.hypot(x1 - x2, y1 - y2); };

export function mergeDuplicateStations(stations, { maxM = 150 } = {}) {
  const nm = (e) => (e.tags?.['name:en'] || e.tags?.name || '').trim();
  const pos = (e) => ({ lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon });
  const out = [], seen = new Set();
  for (const e of stations) {
    const key = nm(e).toLowerCase();
    if (!key || seen.has(key)) continue;
    const prev = out[out.length - 1];
    if (prev && metres(pos(prev), pos(e)) < maxM) {
      if (nm(e).length < nm(prev).length) out[out.length - 1] = e;
    } else out.push(e);
    seen.add(key);
  }
  return out;
}

/** Line name without the direction part OSM adds to each variant ("Green Line BRT: Surjani => Numaish" -> "Green Line BRT"). */
export const baseLineName = (name) => String(name ?? '').split(/\s*(?::|=>|→|->|⇒)\s*/)[0].trim();

const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

/**
 * Metro / BRT lines of one city from an Overpass result (route relations + their stop nodes + route_masters).
 * Variants of the same line (directions, short turns) are grouped by route_master, else by ref, else by base name;
 * the variant with the most named stops is kept. Feeder routes and lines with fewer than `minStops` are dropped.
 * Everything comes from OSM tags; missing values stay null.
 */
export function pickLines(elements, city, { minStops = 5, stations = [] } = {}) {
  const routes = elements.filter((e) => e.type === 'relation' && e.tags?.type === 'route');
  const masters = elements.filter((e) => e.type === 'relation' && e.tags?.type === 'route_master');
  const masterOf = new Map();
  for (const m of masters) for (const mem of m.members ?? []) if (mem.type === 'relation') masterOf.set(mem.ref, m);
  const groups = new Map();
  for (const r of routes) {
    if (/feeder/i.test(r.tags?.name ?? '')) continue;
    const m = masterOf.get(r.id);
    const key = m ? `m${m.id}` : r.tags?.ref ? `ref:${r.tags.ref}` : `n:${baseLineName(r.tags?.name).toLowerCase()}`;
    let stops = orderedStops(r, elements), from = 'relation';
    if (stops.length < minStops && stations.length) {
      const track = trackOf(r);
      const along = mergeDuplicateStations(tidyLineStations(track ? stationsAlong(track, stations) : stationsNearTrack(trackPoints(r), stations)));
      if (along.length > stops.length) { stops = along; from = track ? 'track' : 'track-unordered'; }
    }
    const g = groups.get(key);
    if (!g || stops.length > g.stops.length) groups.set(key, { r, m, stops, from });
  }
  const lines = [];
  const used = new Set();
  for (const { r, m, stops, from } of groups.values()) {
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
      stopsFrom: from, // 'relation' = the route's own stop members; 'track' = named stations matched to the drawn track
      stations: stops.map((n, i) => ({
        id: `${id}_${String(i + 1).padStart(2, '0')}`,
        name: pick(n.tags, 'name:en', 'name'),
        ...(n.osmName ? { osmName: n.osmName } : {}),
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

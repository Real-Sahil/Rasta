// Pure helpers for turning satellite flood-extent polygons into a small clipped layer. No I/O.

const bboxOfRing = (ring) => {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of ring) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  return [w, s, e, n];
};
export const bboxIntersects = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

// Douglas-Peucker on a ring (iterative, tolerance in degrees).
export function simplifyRing(ring, tol) {
  const pts = ring.slice(0, -1); // drop closing point
  if (pts.length <= 4) return ring;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let d;
      if (len2 === 0) d = Math.hypot(px - ax, py - ay);
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      }
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  const out = pts.filter((_, i) => keep[i]);
  if (out.length < 3) return null;
  out.push(out[0]);
  return out;
}

export const ringArea = (ring) => {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(a / 2);
};

const round = (ring, dp) => ring.map(([x, y]) => [+x.toFixed(dp), +y.toFixed(dp)]);

/** Keep polygons whose bbox touches `bbox`; simplify; drop specks smaller than `minArea` (deg²). */
export function clipAndSimplify(features, { bbox, tol = 0.0003, minArea = 2e-8, decimals = 4 }) {
  const out = [];
  for (const f of features) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of polys) {
      if (!poly.length || !bboxIntersects(bboxOfRing(poly[0]), bbox)) continue;
      if (ringArea(poly[0]) < minArea) continue;
      const rings = [];
      for (let i = 0; i < poly.length; i++) {
        const r = simplifyRing(poly[i], tol);
        if (r && (i === 0 || ringArea(r) >= minArea)) rings.push(round(r, decimals));
        else if (i === 0) break;
      }
      if (rings.length && rings[0].length >= 4) out.push(rings);
    }
  }
  return out; // array of polygons (each an array of rings)
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const R = 6371008.8; // mean Earth radius, metres
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial compass bearing a→b in degrees [0, 360). */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/** Cumulative distance (m) at each vertex; result[0] = 0. */
export function cumulativeLengths(path: LatLng[]): number[] {
  const out = [0];
  for (let i = 1; i < path.length; i++) out.push(out[i - 1] + haversineM(path[i - 1], path[i]));
  return out;
}

export interface SegmentProjection {
  t: number; // 0..1 along the segment
  point: LatLng;
  distM: number; // perpendicular (clamped) distance from p to the segment
}

/** Project p onto segment a-b using a local metric (equirectangular) frame centred on a. */
export function projectOnSegment(p: LatLng, a: LatLng, b: LatLng): SegmentProjection {
  const kx = Math.cos(rad(a.lat)) * (Math.PI / 180) * R;
  const ky = (Math.PI / 180) * R;
  const bx = (b.lng - a.lng) * kx;
  const by = (b.lat - a.lat) * ky;
  const px = (p.lng - a.lng) * kx;
  const py = (p.lat - a.lat) * ky;
  const len2 = bx * bx + by * by;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  const dx = px - t * bx;
  const dy = py - t * by;
  return {
    t,
    point: { lat: a.lat + (t * by) / ky, lng: a.lng + (t * bx) / kx },
    distM: Math.sqrt(dx * dx + dy * dy)
  };
}

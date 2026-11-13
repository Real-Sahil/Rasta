/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { LatLng, projectOnSegment } from './geo';

export interface RouteMatch {
  alongM: number; // distance travelled along the route to the matched point
  distFromRouteM: number; // perpendicular distance from the route
  segmentIndex: number;
  point: LatLng;
}

function scan(path: LatLng[], cum: number[], pos: LatLng, from: number, to: number): RouteMatch | null {
  let best: RouteMatch | null = null;
  for (let i = from; i < to; i++) {
    const pr = projectOnSegment(pos, path[i], path[i + 1]);
    if (!best || pr.distM < best.distFromRouteM) {
      best = {
        alongM: cum[i] + pr.t * (cum[i + 1] - cum[i]),
        distFromRouteM: pr.distM,
        segmentIndex: i,
        point: pr.point
      };
    }
  }
  return best;
}

/**
 * Match a position to a route polyline using true segment projection.
 * Searches near the last known progress first (so loops/overlaps don't teleport the user),
 * then falls back to the whole route when nothing nearby fits (recovery after leaving the route).
 */
export function matchToRoute(
  path: LatLng[],
  cum: number[],
  pos: LatLng,
  lastAlongM = 0,
  nearThresholdM = 60
): RouteMatch | null {
  if (path.length < 2) return null;
  const segs = path.length - 1;
  // window: segments overlapping [lastAlong - 150, lastAlong + 1500]
  let lo = 0;
  while (lo < segs - 1 && cum[lo + 1] < lastAlongM - 150) lo++;
  let hi = lo;
  while (hi < segs && cum[hi] < lastAlongM + 1500) hi++;
  const near = scan(path, cum, pos, lo, Math.max(hi, lo + 1));
  if (near && near.distFromRouteM <= nearThresholdM) return near;
  const all = scan(path, cum, pos, 0, segs);
  return all && near && near.distFromRouteM <= all.distFromRouteM + 1 ? near : all;
}

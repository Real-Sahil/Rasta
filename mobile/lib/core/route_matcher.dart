import 'geo.dart';

class RouteMatch {
  const RouteMatch(this.alongM, this.distFromRouteM, this.segmentIndex, this.point);
  final double alongM; // distance travelled along the route to the matched point
  final double distFromRouteM; // perpendicular distance from the route
  final int segmentIndex;
  final LatLng point;
}

RouteMatch? _scan(List<LatLng> path, List<double> cum, LatLng pos, int from, int to) {
  RouteMatch? best;
  for (var i = from; i < to; i++) {
    final pr = projectOnSegment(pos, path[i], path[i + 1]);
    if (best == null || pr.distM < best.distFromRouteM) {
      best = RouteMatch(cum[i] + pr.t * (cum[i + 1] - cum[i]), pr.distM, i, pr.point);
    }
  }
  return best;
}

/// Match a position to a route polyline using true segment projection.
/// Searches near the last known progress first (so loops/overlaps don't teleport the user),
/// then falls back to the whole route when nothing nearby fits (recovery after leaving the route).
RouteMatch? matchToRoute(List<LatLng> path, List<double> cum, LatLng pos, {double lastAlongM = 0, double nearThresholdM = 60}) {
  if (path.length < 2) return null;
  final segs = path.length - 1;
  // window: segments overlapping [lastAlong - 150, lastAlong + 1500]
  var lo = 0;
  while (lo < segs - 1 && cum[lo + 1] < lastAlongM - 150) {
    lo++;
  }
  var hi = lo;
  while (hi < segs && cum[hi] < lastAlongM + 1500) {
    hi++;
  }
  final near = _scan(path, cum, pos, lo, hi > lo + 1 ? hi : lo + 1);
  if (near != null && near.distFromRouteM <= nearThresholdM) return near;
  final all = _scan(path, cum, pos, 0, segs);
  return (all != null && near != null && near.distFromRouteM <= all.distFromRouteM + 1) ? near : all;
}

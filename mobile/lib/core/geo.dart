import 'dart:math' as math;

class LatLng {
  const LatLng(this.lat, this.lng);
  final double lat;
  final double lng;

  @override
  bool operator ==(Object other) => other is LatLng && other.lat == lat && other.lng == lng;
  @override
  int get hashCode => Object.hash(lat, lng);
  @override
  String toString() => 'LatLng($lat, $lng)';
}

const double _r = 6371008.8; // mean Earth radius, metres
double _rad(double d) => d * math.pi / 180;

double haversineM(LatLng a, LatLng b) {
  final dLat = _rad(b.lat - a.lat);
  final dLng = _rad(b.lng - a.lng);
  final h = math.pow(math.sin(dLat / 2), 2) + math.cos(_rad(a.lat)) * math.cos(_rad(b.lat)) * math.pow(math.sin(dLng / 2), 2);
  return 2 * _r * math.asin(math.min(1.0, math.sqrt(h)));
}

/// Initial compass bearing a to b in degrees [0, 360).
double bearingDeg(LatLng a, LatLng b) {
  final y = math.sin(_rad(b.lng - a.lng)) * math.cos(_rad(b.lat));
  final x = math.cos(_rad(a.lat)) * math.sin(_rad(b.lat)) - math.sin(_rad(a.lat)) * math.cos(_rad(b.lat)) * math.cos(_rad(b.lng - a.lng));
  return (((math.atan2(y, x) * 180) / math.pi) + 360) % 360;
}

/// Cumulative distance (m) at each vertex; result[0] = 0.
List<double> cumulativeLengths(List<LatLng> path) {
  final out = <double>[0];
  for (var i = 1; i < path.length; i++) {
    out.add(out[i - 1] + haversineM(path[i - 1], path[i]));
  }
  return out;
}

class SegmentProjection {
  const SegmentProjection(this.t, this.point, this.distM);
  final double t; // 0..1 along the segment
  final LatLng point;
  final double distM; // clamped perpendicular distance from p to the segment
}

/// Project p onto segment a-b in a local metric (equirectangular) frame centred on a.
SegmentProjection projectOnSegment(LatLng p, LatLng a, LatLng b) {
  final kx = math.cos(_rad(a.lat)) * (math.pi / 180) * _r;
  final ky = (math.pi / 180) * _r;
  final bx = (b.lng - a.lng) * kx;
  final by = (b.lat - a.lat) * ky;
  final px = (p.lng - a.lng) * kx;
  final py = (p.lat - a.lat) * ky;
  final len2 = bx * bx + by * by;
  final t = len2 == 0 ? 0.0 : math.max(0.0, math.min(1.0, (px * bx + py * by) / len2));
  final dx = px - t * bx;
  final dy = py - t * by;
  return SegmentProjection(t, LatLng(a.lat + (t * by) / ky, a.lng + (t * bx) / kx), math.sqrt(dx * dx + dy * dy));
}

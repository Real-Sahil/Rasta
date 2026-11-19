import 'dart:convert';

import 'package:http/http.dart' as http;

import 'geo.dart';
import 'route.dart';

class RouteRequest {
  const RouteRequest({required this.from, required this.to, required this.destId, required this.mode, this.fromId});
  final LatLng from;
  final LatLng to;
  final String destId;

  /// Identifies a custom start point so route ids never collide across starts. Null = "my location".
  final String? fromId;
  final TravelMode mode;
}

enum RouteSource { network, estimate }

class RouteResult {
  const RouteResult(this.routes, this.source);
  final List<RouteOption> routes;
  final RouteSource source;
}

class RouteCancelled implements Exception {
  const RouteCancelled();
}

// Public OSRM only has a car profile; walking uses the FOSSGIS foot server. Free servers, no SLA: replace with a
// paid or self-hosted OSRM-compatible server for production by putting it first here.
const List<String> carEndpoints = [
  'https://router.project-osrm.org/route/v1/driving',
  'https://routing.openstreetmap.de/routed-car/route/v1/driving',
];
const List<String> footEndpoints = ['https://routing.openstreetmap.de/routed-foot/route/v1/driving'];

List<String> endpointsFor(TravelMode m) => m == TravelMode.walking ? footEndpoints : carEndpoints;

String modeName(TravelMode m) => switch (m) { TravelMode.driving => 'DRIVING', TravelMode.walking => 'WALKING', TravelMode.twoWheeler => 'TWO_WHEELER' };

String buildOsrmUrl(RouteRequest req, [String? base]) {
  final b = base ?? endpointsFor(req.mode).first;
  return '$b/${req.from.lng},${req.from.lat};${req.to.lng},${req.to.lat}?overview=full&geometries=geojson&steps=true&alternatives=true';
}

/// The two longest named roads of a route, used as its "via" label.
List<String> mainRoads(List<dynamic> steps) {
  final byName = <String, num>{};
  for (final st in steps) {
    if (st is! Map) continue;
    final name = st['name'];
    if (name is String && name.isNotEmpty) byName[name] = (byName[name] ?? 0) + ((st['distance'] as num?) ?? 0);
  }
  final entries = byName.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
  return entries.take(2).map((e) => e.key).toList();
}

/// Build readable instructions from an OSRM maneuver (OSRM does not return instruction text).
NavStep osrmStep(Map<dynamic, dynamic> s) {
  final m = s['maneuver'] is Map ? s['maneuver'] as Map : const {};
  final type = (m['type'] as String?) ?? 'continue';
  final mod = (m['modifier'] as String?) ?? 'straight';
  final name = s['name'] is String ? s['name'] as String : '';
  final onto = name.isNotEmpty ? ' onto $name' : '';
  const modUr = {
    'left': 'بائیں مڑیں', 'right': 'دائیں مڑیں', 'straight': 'سیدھا چلیں',
    'slight left': 'ہلکا بائیں مڑیں', 'slight right': 'ہلکا دائیں مڑیں',
    'sharp left': 'تیز بائیں مڑیں', 'sharp right': 'تیز دائیں مڑیں', 'uturn': 'یو ٹرن لیں',
  };
  String instruction;
  String instructionUrdu;
  var maneuver = 'straight';
  if (type == 'arrive') {
    instruction = 'Arrive at destination';
    instructionUrdu = 'منزل پر پہنچیں';
    maneuver = 'arrive';
  } else if (type == 'depart') {
    instruction = name.isNotEmpty ? 'Head out on $name' : 'Head toward destination';
    instructionUrdu = 'روانہ ہوں';
  } else if (type == 'roundabout' || type == 'rotary' || type == 'roundabout turn') {
    instruction = 'Enter the roundabout$onto';
    instructionUrdu = 'چوراہے میں داخل ہوں';
    maneuver = 'roundabout';
  } else if (type == 'merge') {
    instruction = 'Merge$onto';
    instructionUrdu = 'سڑک میں شامل ہوں';
    maneuver = 'merge';
  } else {
    final dir = mod == 'straight' ? 'Continue straight' : (mod == 'uturn' ? 'Make a U-turn' : 'Turn $mod');
    instruction = '$dir$onto';
    instructionUrdu = modUr[mod] ?? 'آگے بڑھیں';
    if (mod.contains('left')) {
      maneuver = 'turn-left';
    } else if (mod.contains('right')) {
      maneuver = 'turn-right';
    } else if (mod == 'uturn') {
      maneuver = 'u-turn';
    }
  }
  return NavStep(
    instruction: instruction,
    instructionUrdu: instructionUrdu,
    maneuver: maneuver,
    distanceMeters: ((s['distance'] as num?) ?? 0).round(),
    durationSeconds: ((s['duration'] as num?) ?? 0).round(),
  );
}

/// Validate and convert an OSRM response. Returns an empty list for anything malformed.
List<RouteOption> parseOsrmRoutes(dynamic data, RouteRequest req) {
  if (data is! Map || data['code'] != 'Ok' || data['routes'] is! List) return [];
  final out = <RouteOption>[];
  final routes = (data['routes'] as List).take(3).toList();
  for (var idx = 0; idx < routes.length; idx++) {
    final r = routes[idx];
    if (r is! Map) continue;
    final coords = (r['geometry'] is Map) ? (r['geometry'] as Map)['coordinates'] : null;
    final legs = r['legs'];
    final steps = (legs is List && legs.isNotEmpty && legs.first is Map) ? (legs.first as Map)['steps'] : null;
    final dist = r['distance'];
    if (coords is! List || coords.length < 2 || steps is! List || dist is! num || !dist.isFinite) continue;
    final km = double.parse((dist / 1000).toStringAsFixed(1));
    final roads = mainRoads(steps);
    out.add(RouteOption(
      id: 'osrm_${req.fromId ?? 'me'}_${req.destId}_${modeName(req.mode)}_$idx',
      title: idx == 0 ? 'Recommended route' : 'Alternative route $idx',
      titleUrdu: idx == 0 ? 'تجویز کردہ راستہ' : 'متبادل راستہ $idx',
      via: roads.isNotEmpty ? roads.join(' & ') : 'Main roads',
      viaUrdu: roads.isNotEmpty ? roads.join(' اور ') : 'مرکزی سڑکیں',
      distanceKm: km,
      durationMinutes: (((r['duration'] as num?) ?? 60) / 60).round().clamp(1, 1 << 30),
      isRecommended: idx == 0,
      steps: steps.whereType<Map>().map(osrmStep).toList(),
      path: coords.map<LatLng>((c) => LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble())).toList(),
    ));
  }
  return out;
}

/// Offline fallback: one clearly-labelled straight-line estimate (no invented streets, tolls or traffic).
RouteOption estimateRoute(RouteRequest req) {
  final straightKm = haversineM(req.from, req.to) / 1000;
  final walking = req.mode == TravelMode.walking;
  final factor = walking ? 1.2 : 1.35;
  final speedKmh = walking ? 5.0 : (req.mode == TravelMode.twoWheeler ? 25.0 : 30.0);
  final km = double.parse((straightKm * factor).toStringAsFixed(1)).clamp(0.1, double.infinity).toDouble();
  final minutes = ((km / speedKmh) * 60).round().clamp(1, 1 << 30);
  final meters = (km * 1000).round();
  final path = List.generate(13, (i) => LatLng(req.from.lat + (req.to.lat - req.from.lat) * i / 12, req.from.lng + (req.to.lng - req.from.lng) * i / 12));
  return RouteOption(
    id: 'local_${req.fromId ?? 'me'}_${req.destId}_${modeName(req.mode)}',
    title: 'Estimated route (offline)',
    titleUrdu: 'اندازہً راستہ (آف لائن)',
    via: 'Straight-line estimate, no road data. Connect to the internet for turn-by-turn routing',
    viaUrdu: 'سیدھی لکیر کا اندازہ، سڑک کا ڈیٹا دستیاب نہیں۔ درست رہنمائی کے لیے انٹرنیٹ سے جڑیں',
    distanceKm: km,
    durationMinutes: minutes,
    isRecommended: true,
    steps: [
      NavStep(instruction: 'Head toward your destination', instructionUrdu: 'اپنی منزل کی طرف روانہ ہوں', distanceMeters: (meters - 1).clamp(1, 1 << 30), durationSeconds: (minutes * 60 - 1).clamp(1, 1 << 30), maneuver: 'straight'),
      const NavStep(instruction: 'Arrive at destination', instructionUrdu: 'منزل پر پہنچیں', distanceMeters: 1, durationSeconds: 1, maneuver: 'arrive'),
    ],
    path: path,
  );
}

// Short-lived cache so a repeat request (same start, destination and mode) doesn't hit the public servers again.
const Duration _cacheTtl = Duration(minutes: 2);
final Map<String, ({DateTime at, List<RouteOption> routes})> _cache = {};
String _cacheKey(RouteRequest r) =>
    '${modeName(r.mode)}|${r.destId}|${r.from.lat.toStringAsFixed(4)},${r.from.lng.toStringAsFixed(4)}|${r.to.lat.toStringAsFixed(4)},${r.to.lng.toStringAsFixed(4)}';
void clearRouteCache() => _cache.clear();

typedef GetFn = Future<http.Response> Function(Uri url);

/// Real road routes, failing over across servers with a timeout; falls back to a labelled estimate.
/// [isCancelled] lets the caller drop a stale request (a newer one replaced it).
Future<RouteResult> fetchRoutes(
  RouteRequest req, {
  GetFn? get,
  bool Function()? isCancelled,
  Duration timeout = const Duration(seconds: 6),
  DateTime Function()? now,
}) async {
  final f = get ?? http.get;
  final clock = now ?? DateTime.now;
  final key = _cacheKey(req);
  final hit = _cache[key];
  if (hit != null && clock().difference(hit.at) < _cacheTtl) return RouteResult(hit.routes, RouteSource.network);

  for (final base in endpointsFor(req.mode)) {
    if (isCancelled?.call() ?? false) throw const RouteCancelled();
    try {
      final res = await f(Uri.parse(buildOsrmUrl(req, base))).timeout(timeout);
      if (isCancelled?.call() ?? false) throw const RouteCancelled();
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final routes = parseOsrmRoutes(jsonDecode(res.body), req);
        if (routes.isNotEmpty) {
          _cache[key] = (at: clock(), routes: routes);
          return RouteResult(routes, RouteSource.network);
        }
      }
    } on RouteCancelled {
      rethrow;
    } catch (_) {
      // timeout, 429/5xx or unusable body: fall through to the next server
    }
  }
  return RouteResult([estimateRoute(req)], RouteSource.estimate);
}

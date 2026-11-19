import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/geo.dart';
import '../core/places.dart';
import 'api_client.dart' show apiBase;

/// Nearest hospitals / fuel anywhere in Pakistan through our API (`?op=nearby`, Geoapify Places serving
/// OpenStreetMap data; the key stays on the server). The point is rounded to ~1 km before it leaves the phone.
/// Returns null when the server can't answer, so the caller can fall back to the bundled Lahore extract.
class NearbyService {
  NearbyService({http.Client? client, String? api = apiBase})
      : _client = client ?? http.Client(),
        _api = api; // ignore: prefer_initializing_formals
  final http.Client _client;
  final String? _api;
  final Map<String, List<Poi>> _cache = {};

  static String roundedKey(String kind, LatLng p) => '$kind|${p.lat.toStringAsFixed(2)},${p.lng.toStringAsFixed(2)}';

  Future<List<Poi>?> nearby(String kind, LatLng near) async {
    final base = _api;
    if (base == null) return null;
    final key = roundedKey(kind, near);
    final hit = _cache[key];
    if (hit != null) return hit;
    try {
      final uri = Uri.parse(base).replace(queryParameters: {'op': 'nearby', 'kind': kind, 'near': key.split('|').last});
      final r = await _client.get(uri).timeout(const Duration(seconds: 10));
      if (r.statusCode != 200) return null;
      final body = jsonDecode(r.body);
      final items = body is Map ? body['items'] : null;
      if (items is! List) return null;
      final out = [for (final i in items) if (Poi.fromJson(i) != null) Poi.fromJson(i)!];
      if (_cache.length > 20) _cache.clear();
      return _cache[key] = out;
    } catch (_) {
      return null;
    }
  }
}

import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/geo.dart';

class Place {
  const Place({required this.id, required this.name, required this.detail, required this.point});
  final String id;
  final String name;
  final String detail;
  final LatLng point;
}

/// Place search through Nominatim (OpenStreetMap), limited to Pakistan. The query leaves the device: the privacy
/// copy must say so. Public Nominatim has no SLA and requires an identifying User-Agent.
class SearchService {
  SearchService({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;
  final Map<String, List<Place>> _cache = {};
  int _seq = 0;

  /// Returns null when a newer search replaced this one (drop the result), [] when nothing was found.
  Future<List<Place>?> search(String query, {LatLng? near}) async {
    final q = query.trim();
    if (q.length < 2) return [];
    final key = q.toLowerCase();
    final hit = _cache[key];
    if (hit != null) return hit;
    final mine = ++_seq;
    final params = {'q': q, 'format': 'jsonv2', 'countrycodes': 'pk', 'limit': '6', 'addressdetails': '0'};
    if (near != null) {
      params['viewbox'] = '${near.lng - 0.5},${near.lat + 0.5},${near.lng + 0.5},${near.lat - 0.5}';
    }
    final res = await _client
        .get(Uri.https('nominatim.openstreetmap.org', '/search', params), headers: {'User-Agent': 'BuraqPakistan-mobile/1.0', 'Accept-Language': 'en,ur'})
        .timeout(const Duration(seconds: 6));
    if (mine != _seq) return null;
    if (res.statusCode != 200) return [];
    final list = jsonDecode(res.body);
    final out = <Place>[];
    if (list is List) {
      for (final p in list) {
        if (p is! Map) continue;
        final lat = double.tryParse('${p['lat']}');
        final lon = double.tryParse('${p['lon']}');
        final display = '${p['display_name'] ?? ''}';
        if (lat == null || lon == null || display.isEmpty) continue;
        final parts = display.split(', ');
        out.add(Place(id: '${p['place_id']}', name: parts.first, detail: parts.skip(1).take(3).join(', '), point: LatLng(lat, lon)));
      }
    }
    _cache[key] = out;
    return out;
  }
}

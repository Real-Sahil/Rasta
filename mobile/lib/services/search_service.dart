import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../core/geo.dart';

class Place {
  const Place({required this.id, required this.name, required this.detail, required this.point});
  final String id;
  final String name;
  final String detail;
  final LatLng point;
}

/// Why a search failed, so the UI can tell "no internet" from "the search service is busy".
class SearchException implements Exception {
  const SearchException(this.busy, [this.detail = '']);
  final String detail; // exception type / HTTP status, shown small so a failure on a real phone can be diagnosed
  final bool busy; // true: the server answered with an error / rate limit; false: no connection or timeout
  @override
  String toString() => busy ? 'SearchException(busy)' : 'SearchException(offline)';
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
    final uri = Uri.https('nominatim.openstreetmap.org', '/search', params);
    final headers = {'User-Agent': 'BuraqPakistan-mobile/1.0 (+https://github.com/Real-Sahil/Rasta)', 'Accept-Language': 'en,ur'};
    http.Response? res;
    SearchException? failure;
    // One retry: a first request on a cold mobile connection often times out or resets.
    for (var attempt = 0; attempt < 2 && res == null; attempt++) {
      try {
        final r = await _client.get(uri, headers: headers).timeout(const Duration(seconds: 8));
        if (r.statusCode == 200) {
          res = r;
        } else {
          failure = SearchException(true, 'HTTP ${r.statusCode}'); // 403/429/5xx: server reachable but refusing or overloaded
          if (r.statusCode != 429 && r.statusCode < 500) break;
        }
      } on TimeoutException {
        failure = const SearchException(false, 'timeout');
      } on SocketException catch (e) {
        failure = SearchException(false, 'SocketException: ${e.message}');
      } on http.ClientException catch (e) {
        failure = SearchException(false, 'ClientException: ${e.message}');
      } on IOException catch (e) {
        failure = SearchException(false, '${e.runtimeType}'); // e.g. TLS handshake failure
      } catch (e) {
        throw SearchException(true, '${e.runtimeType}'); // not a network problem: do not call it "no internet"
      }
      if (mine != _seq) return null;
      if (res == null && attempt == 0) await Future<void>.delayed(const Duration(milliseconds: 600));
    }
    if (mine != _seq) return null;
    if (res == null) throw failure ?? const SearchException(false);
    final dynamic list;
    try {
      list = jsonDecode(res.body);
    } on FormatException {
      throw const SearchException(true, 'bad response');
    }
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

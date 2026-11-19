import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/conditions.dart';
import '../core/geo.dart';

typedef Fetch = Future<http.Response> Function(Uri url);

Future<http.Response> _defaultFetch(Uri url) => http.get(url).timeout(const Duration(seconds: 6));

/// Weather + air quality for a city centre. Each half fails independently; an empty result means "not available".
Future<Conditions> fetchConditions(String city, {Fetch? fetch}) => fetchConditionsAt(centreOf(city), fetch: fetch);

/// Same for any point; callers pass a city centre or [roundedForWeather] of a real fix, never a raw fix.
Future<Conditions> fetchConditionsAt(LatLng c, {Fetch? fetch}) async {
  final get = fetch ?? _defaultFetch;
  var out = const Conditions();
  Future<Object?> json(Uri u) async {
    try {
      final r = await get(u);
      return r.statusCode == 200 ? jsonDecode(utf8.decode(r.bodyBytes)) : null;
    } catch (_) {
      return null;
    }
  }
  final results = await Future.wait([json(weatherUri(c)), json(aqiUri(c))]);
  out = parseWeather(results[0], out);
  out = parseAqi(results[1], out);
  return out;
}

LatLng centreOf(String city) => cityCentres[city] ?? cityCentres['lahore']!;

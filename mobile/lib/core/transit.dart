// Metrobus / Orange Line stations (bundled OpenStreetMap extract, ordered along each line) and the station-count fare
// estimate. Port of the calculator in src/components/TransitPlanner.tsx. Fares are ESTIMATES, not official tariffs.
import 'dart:convert';
import 'dart:math' as math;

import 'geo.dart';

class Station {
  const Station({required this.id, required this.code, required this.name, this.nameUrdu, required this.line, required this.point});
  final String id, code, name, line;
  final String? nameUrdu;
  final LatLng point;

  static Station? fromJson(Object? j) {
    if (j is! Map) return null;
    final id = j['id'], name = j['name'], lat = j['lat'], lng = j['lng'];
    if (id is! String || name is! String || name.trim().isEmpty || lat is! num || lng is! num) return null;
    final u = j['nameUrdu'];
    return Station(
      id: id,
      code: j['code'] is String ? j['code'] as String : '',
      name: name.trim(),
      nameUrdu: u is String && u.trim().isNotEmpty ? u.trim() : null,
      line: j['line'] is String ? j['line'] as String : '',
      point: LatLng(lat.toDouble(), lng.toDouble()),
    );
  }

  String label(String lang) => (lang == 'ur' || lang == 'pa') && nameUrdu != null ? nameUrdu! : name;
}

/// Stations in file order (already ordered along the line). Malformed rows are dropped, never guessed.
List<Station> parseStations(String json) {
  final d = jsonDecode(json);
  final items = d is Map ? d['items'] : null;
  if (items is! List) return const [];
  return [for (final i in items) if (Station.fromJson(i) != null) Station.fromJson(i)!];
}

/// Fare for [stationCount] stops. Orange Line is banded; Metrobus is a flat estimate. Students pay half (rounded).
int transitFare(String line, int stationCount, {bool student = false}) {
  if (stationCount <= 0) return 0;
  var f = 30;
  if (line == 'orangeline') {
    f = stationCount <= 4 ? 20 : stationCount <= 8 ? 25 : stationCount <= 12 ? 30 : stationCount <= 16 ? 35 : 40;
  }
  return student ? (f / 2).round() : f;
}

/// Rough in-vehicle time (minutes) from the number of stops; an estimate, not a timetable.
int transitMinutes(String line, int stationCount) {
  if (stationCount <= 0) return 0;
  return (line == 'metrobus' ? math.max(5, stationCount * 2.8) : math.max(4, stationCount * 2.1)).round();
}

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

/// A metro / BRT line outside Lahore (`assets/osm/lines.json`), stations in route order. Port of web `METRO_LINES`.
class MetroLine {
  const MetroLine({required this.id, required this.city, required this.name, this.nameUrdu, this.colour, required this.stations});
  final String id, city, name;
  final String? nameUrdu;
  final int? colour; // ARGB from OSM `colour` (#rrggbb), null when OSM has none
  final List<Station> stations;

  String label(String lang) => (lang == 'ur' || lang == 'pa') && nameUrdu != null ? nameUrdu! : name;
}

/// Lines with at least two named stations; unnamed stops are dropped, never labelled with a guess.
/// Each station's code is its position along the line.
List<MetroLine> parseLines(String json) {
  final d = jsonDecode(json);
  final items = d is Map ? d['items'] : null;
  if (items is! List) return const [];
  final out = <MetroLine>[];
  for (final l in items) {
    if (l is! Map || l['id'] is! String || l['city'] is! String || l['name'] is! String || l['stations'] is! List) continue;
    final raw = [for (final s in l['stations'] as List) if (Station.fromJson(s) != null) Station.fromJson(s)!];
    final stations = [
      for (var i = 0; i < raw.length; i++)
        Station(id: raw[i].id, code: '${i + 1}', name: raw[i].name, nameUrdu: raw[i].nameUrdu, line: l['id'] as String, point: raw[i].point),
    ];
    if (stations.length < 2) continue;
    final c = l['colour'];
    final hex = c is String && RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(c) ? int.parse(c.substring(1), radix: 16) | 0xFF000000 : null;
    final u = l['nameUrdu'];
    out.add(MetroLine(id: l['id'] as String, city: l['city'] as String, name: l['name'] as String, nameUrdu: u is String && u.trim().isNotEmpty ? u.trim() : null, colour: hex, stations: stations));
  }
  return out;
}

/// Area key in lines.json for a point: the nearest listed city within 80 km, with Islamabad and Rawalpindi merged.
String metroCityFor(String? weatherCity) =>
    weatherCity == 'islamabad' || weatherCity == 'rawalpindi' ? 'islamabad_rawalpindi' : (weatherCity ?? 'lahore');

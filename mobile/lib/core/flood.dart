// Past-flooding layer: UNOSAT satellite-detected flood extents (via HDX, CC BY-SA), historical only.
import 'dart:convert';

class FloodEvent {
  const FloodEvent({required this.id, required this.polygons});
  final String id;
  final List<dynamic> polygons; // GeoJSON MultiPolygon coordinates
}

const floodColours = ['#2563eb', '#0891b2', '#7c3aed'];

List<FloodEvent> parseFlood(String json) {
  final d = jsonDecode(json);
  final ev = d is Map ? d['events'] : null;
  if (ev is! List) return const [];
  final out = <FloodEvent>[];
  for (final e in ev) {
    if (e is Map && e['id'] is String && e['polygons'] is List && (e['polygons'] as List).isNotEmpty) {
      out.add(FloodEvent(id: e['id'] as String, polygons: e['polygons'] as List));
    }
  }
  return out;
}

Map<String, dynamic> floodGeoJson(FloodEvent e) => {
      'type': 'Feature',
      'properties': <String, dynamic>{},
      'geometry': {'type': 'MultiPolygon', 'coordinates': e.polygons},
    };

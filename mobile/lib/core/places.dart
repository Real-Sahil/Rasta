// Hospitals and fuel stations from OpenStreetMap (ODbL), bundled in assets/osm. Unknown values stay null.
import 'dart:convert';

import 'geo.dart';

const osmCredit = '© OpenStreetMap contributors (ODbL)';

class Poi {
  const Poi({required this.id, required this.kind, required this.name, this.nameUrdu, required this.point, this.address, this.phone, this.open24h, this.emergency});
  final String id, kind, name;
  final String? nameUrdu, address, phone;
  final bool? open24h, emergency;
  final LatLng point;

  String label(String lang) => (lang != 'en' && nameUrdu != null) ? nameUrdu! : name;

  static Poi? fromJson(Object? j) {
    if (j is! Map) return null;
    final lat = j['lat'], lng = j['lng'];
    if (j['id'] is! String || j['name'] is! String || lat is! num || lng is! num) return null;
    String? s(Object? v) => v is String && v.trim().isNotEmpty ? v.trim() : null;
    return Poi(
      id: j['id'] as String, kind: s(j['kind']) ?? 'poi', name: j['name'] as String, nameUrdu: s(j['nameUrdu']),
      point: LatLng(lat.toDouble(), lng.toDouble()), address: s(j['address']), phone: s(j['phone']),
      open24h: j['open24h'] is bool ? j['open24h'] as bool : null, emergency: j['emergency'] is bool ? j['emergency'] as bool : null,
    );
  }
}

class PoiFile {
  const PoiFile(this.items, this.fetchedAt);
  final List<Poi> items;
  final String? fetchedAt; // yyyy-mm-dd
}

PoiFile parsePoiFile(String source) {
  final j = jsonDecode(source);
  final items = (j is Map ? j['items'] : null) as List? ?? const [];
  final at = j is Map && j['meta'] is Map ? (j['meta'] as Map)['fetchedAt'] : null;
  return PoiFile([for (final i in items) if (Poi.fromJson(i) != null) Poi.fromJson(i)!], at is String && at.length >= 10 ? at.substring(0, 10) : null);
}

class NearPoi {
  const NearPoi(this.poi, this.distanceM);
  final Poi poi;
  final double? distanceM;
}

/// Nearest first with a real fix, otherwise alphabetical (no fake "nearby").
List<NearPoi> nearest(List<Poi> all, LatLng? from, {int limit = 30}) {
  final l = [for (final p in all) NearPoi(p, from == null ? null : haversineM(from, p.point))];
  l.sort((a, b) => a.distanceM != null && b.distanceM != null ? a.distanceM!.compareTo(b.distanceM!) : a.poi.name.compareTo(b.poi.name));
  return l.take(limit).toList();
}

/// The bundled extract only covers the Lahore area; say so when the user is clearly elsewhere.
const dataCoverageKm = 60.0;
const lahoreCentre = LatLng(31.5204, 74.3587);
bool outsideCoverage(LatLng? from) => from != null && haversineM(from, lahoreCentre) > dataCoverageKm * 1000;

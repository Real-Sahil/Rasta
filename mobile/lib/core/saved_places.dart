// Home, Work and recent destinations. Kept on the device only (shared_preferences); never sent anywhere.
import 'dart:convert';

import 'geo.dart';
import '../services/search_service.dart' show Place;

const maxRecent = 5;

class SavedPlaces {
  const SavedPlaces({this.home, this.work, this.recent = const []});
  final Place? home, work;
  final List<Place> recent; // newest first, at most [maxRecent], no duplicates

  /// Two places are the same if they have the same id, or lie within ~30 m (the same spot found twice).
  static bool same(Place a, Place b) => a.id == b.id || haversineM(a.point, b.point) < 30;

  SavedPlaces remember(Place p) {
    if (p.id == 'me') return this; // "my location" is not a destination worth remembering
    return SavedPlaces(home: home, work: work, recent: [p, ...recent.where((r) => !same(r, p))].take(maxRecent).toList());
  }

  SavedPlaces forget(Place p) => SavedPlaces(home: home, work: work, recent: recent.where((r) => !same(r, p)).toList());
  SavedPlaces withHome(Place? p) => SavedPlaces(home: p, work: work, recent: recent);
  SavedPlaces withWork(Place? p) => SavedPlaces(home: home, work: p, recent: recent);
  SavedPlaces clearHistory() => SavedPlaces(home: home, work: work);
  bool get isEmpty => home == null && work == null && recent.isEmpty;

  String encode() => jsonEncode({'home': _enc(home), 'work': _enc(work), 'recent': [for (final r in recent) _enc(r)]});

  static SavedPlaces decode(String? s) {
    if (s == null || s.isEmpty) return const SavedPlaces();
    try {
      final j = jsonDecode(s);
      if (j is! Map) return const SavedPlaces();
      final rec = [for (final r in (j['recent'] is List ? j['recent'] as List : const [])) ?_dec(r)];
      return SavedPlaces(home: _dec(j['home']), work: _dec(j['work']), recent: rec.take(maxRecent).toList());
    } catch (_) {
      return const SavedPlaces(); // corrupt storage: start empty rather than crash
    }
  }

  static Map<String, Object>? _enc(Place? p) =>
      p == null ? null : {'id': p.id, 'name': p.name, 'detail': p.detail, 'lat': p.point.lat, 'lng': p.point.lng};

  static Place? _dec(Object? j) {
    if (j is! Map) return null;
    final lat = j['lat'], lng = j['lng'], id = j['id'], name = j['name'];
    if (lat is! num || lng is! num || id is! String || name is! String || name.isEmpty) return null;
    if (lat.abs() > 90 || lng.abs() > 180) return null;
    return Place(id: id, name: name, detail: j['detail'] is String ? j['detail'] as String : '', point: LatLng(lat.toDouble(), lng.toDouble()));
  }
}

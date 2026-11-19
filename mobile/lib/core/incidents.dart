// Community road reports. Credibility is derived from independent confirmations, never invented.
import 'geo.dart';

const incidentCategories = ['accident', 'congestion', 'closure', 'construction', 'flooding', 'roadblock', 'police_naka', 'hazard'];

int credibilityFor(int confirmations) => (50 + 5 * (confirmations < 0 ? 0 : confirmations)).clamp(0, 95);

class Incident {
  const Incident({
    required this.id,
    required this.category,
    required this.title,
    required this.description,
    required this.locationName,
    required this.advice,
    required this.point,
    required this.createdAt,
    required this.expiresAt,
    required this.confirmations,
    required this.mine,
    required this.confirmed,
  });
  final String id;
  final String category;
  final String title;
  final String description;
  final String? locationName;
  final String? advice;
  final LatLng point;
  final DateTime createdAt;
  final DateTime expiresAt;
  final int confirmations;
  final bool mine;
  final bool confirmed;

  int get credibility => credibilityFor(confirmations);
  bool get canConfirm => !mine && !confirmed;

  Incident copyWith({int? confirmations, bool? confirmed}) => Incident(
        id: id, category: category, title: title, description: description, locationName: locationName, advice: advice,
        point: point, createdAt: createdAt, expiresAt: expiresAt, mine: mine,
        confirmations: confirmations ?? this.confirmations, confirmed: confirmed ?? this.confirmed,
      );

  /// Row shape of `GET /api?op=list`. Returns null for a malformed row instead of guessing.
  static Incident? fromJson(Object? j) {
    if (j is! Map) return null;
    final lat = j['lat'], lng = j['lng'];
    final created = DateTime.tryParse('${j['created_at']}'), expires = DateTime.tryParse('${j['expires_at']}');
    if (j['id'] is! String || j['title'] is! String || lat is! num || lng is! num || created == null || expires == null) return null;
    String? s(Object? v) => v is String && v.trim().isNotEmpty ? v.trim() : null;
    return Incident(
      id: j['id'] as String,
      category: incidentCategories.contains(j['category']) ? j['category'] as String : 'hazard',
      title: j['title'] as String,
      description: s(j['description']) ?? '',
      locationName: s(j['location_name']),
      advice: s(j['advice']),
      point: LatLng(lat.toDouble(), lng.toDouble()),
      createdAt: created,
      expiresAt: expires,
      confirmations: (j['confirmations'] as num?)?.toInt() ?? 0,
      mine: j['mine'] == true,
      confirmed: j['confirmed'] == true,
    );
  }
}

/// Body of `POST ?op=create`. Position must come from a real GPS fix.
Map<String, Object?> incidentBody({required String category, required String title, String description = '', String? locationName, String? advice, required LatLng at}) => {
      'category': category,
      'title': title.trim(),
      'title_ur': null,
      'description': description.trim().isEmpty ? null : description.trim(),
      'description_ur': null,
      'location_name': (locationName ?? '').trim().isEmpty ? null : locationName!.trim(),
      'advice': (advice ?? '').trim().isEmpty ? null : advice!.trim(),
      'lat': at.lat,
      'lng': at.lng,
    };

bool validIncidentTitle(String t) => t.trim().length >= 3 && t.trim().length <= 120;

/// Distance-sorted, nearest first; incidents without a known position of the user keep newest-first order.
List<Incident> sortIncidents(List<Incident> list, LatLng? from) {
  final out = [...list];
  if (from == null) {
    out.sort((a, b) => b.createdAt.compareTo(a.createdAt));
  } else {
    out.sort((a, b) => haversineM(from, a.point).compareTo(haversineM(from, b.point)));
  }
  return out;
}

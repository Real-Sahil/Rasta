import '../core/incidents.dart';
import '../core/geo.dart';
import 'api_client.dart';

class ReportsApi {
  ReportsApi(this.client);
  final ApiClient client;

  Future<List<Incident>> listIncidents() async {
    final data = await client.request('list');
    final rows = (data is Map ? data['incidents'] : null) as List? ?? const [];
    return [for (final r in rows) if (Incident.fromJson(r) != null) Incident.fromJson(r)!];
  }

  Future<void> submitIncident({required String category, required String title, String description = '', String? locationName, String? advice, required LatLng at}) =>
      client.authed('create', incidentBody(category: category, title: title, description: description, locationName: locationName, advice: advice, at: at));
  Future<void> confirm(String id) => client.authed('act', {'id': id, 'action': 'confirm'});
  Future<void> flag(String id) => client.authed('act', {'id': id, 'action': 'flag'});

  Future<List<TransitStat>> transitStats(String city) async {
    final data = await client.request('transit_stats', query: {'city': city});
    final rows = (data is Map ? data['stats'] : null) as List? ?? const [];
    return [for (final r in rows) if (TransitStat.fromJson(r) != null) TransitStat.fromJson(r)!];
  }

  Future<void> sendTransitReport({required String city, required String kind, required String mode, required int value}) =>
      client.authed('transit_report', {'city': city, 'kind': kind, 'mode': mode, 'value': value});
}

const reportModes = ['metrobus', 'orange_line', 'bus', 'van', 'rickshaw', 'taxi', 'ride_hail'];
const reportKinds = ['fare', 'delay'];
/// Cities the backend accepts.
const reportCities = ['lahore', 'karachi', 'islamabad', 'rawalpindi', 'multan', 'faisalabad'];

bool validReportValue(String kind, int? n) => n != null && n >= 1 && n <= (kind == 'fare' ? 20000 : 240);

class TransitStat {
  const TransitStat({required this.kind, required this.mode, required this.n, required this.median, required this.p25, required this.p75});
  final String kind, mode;
  final int n, median, p25, p75;
  static TransitStat? fromJson(Object? j) {
    if (j is! Map) return null;
    int? i(Object? v) => v is num ? v.round() : null;
    final n = i(j['n']), m = i(j['median']), a = i(j['p25']), b = i(j['p75']);
    if (!reportKinds.contains(j['kind']) || !reportModes.contains(j['mode']) || n == null || m == null || a == null || b == null) return null;
    return TransitStat(kind: j['kind'] as String, mode: j['mode'] as String, n: n, median: m, p25: a, p75: b);
  }
}

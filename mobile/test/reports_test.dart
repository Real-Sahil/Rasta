import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

import 'package:buraq_mobile/core/geo.dart';
import 'package:buraq_mobile/core/incidents.dart';
import 'package:buraq_mobile/l10n.dart';
import 'package:buraq_mobile/l10n_app.dart';
import 'package:buraq_mobile/l10n_web.dart';
import 'package:buraq_mobile/services/api_client.dart';
import 'package:buraq_mobile/services/reports_api.dart';

class MemTokens implements TokenStore {
  String? t;
  @override
  Future<String?> read() async => t;
  @override
  Future<void> write(String? token) async => t = token;
}

Map<String, Object?> row({String id = 'a', int c = 2, bool mine = false, bool confirmed = false}) => {
      'id': id, 'category': 'accident', 'title': 'Crash on Canal Road', 'title_ur': null, 'description': null, 'description_ur': null,
      'location_name': 'Canal Road', 'advice': null, 'lat': 31.5, 'lng': 74.3,
      'created_at': '2026-01-01T10:00:00Z', 'expires_at': '2026-01-01T14:00:00Z', 'confirmations': c, 'mine': mine, 'confirmed': confirmed,
    };

void main() {
  test('credibility is 50 + 5 per confirmation, capped at 95', () {
    expect(credibilityFor(0), 50);
    expect(credibilityFor(3), 65);
    expect(credibilityFor(100), 95);
    expect(credibilityFor(-4), 50);
  });

  test('incident rows parse; malformed rows are dropped, not guessed', () {
    final i = Incident.fromJson(row())!;
    expect(i.category, 'accident');
    expect(i.credibility, 60);
    expect(i.canConfirm, isTrue);
    expect(Incident.fromJson(row(mine: true))!.canConfirm, isFalse);
    expect(Incident.fromJson(row(confirmed: true))!.canConfirm, isFalse);
    expect(Incident.fromJson({...row(), 'lat': null}), isNull);
    expect(Incident.fromJson('x'), isNull);
    expect(Incident.fromJson({...row(), 'category': 'weird'})!.category, 'hazard');
  });

  test('create body trims, nulls empties and carries the real position', () {
    final b = incidentBody(category: 'closure', title: '  Road shut ', description: '  ', at: const LatLng(31.5, 74.3));
    expect(b['title'], 'Road shut');
    expect(b['description'], isNull);
    expect(b['lat'], 31.5);
    expect(validIncidentTitle('ab'), isFalse);
    expect(validIncidentTitle('abc'), isTrue);
  });

  test('sorting: nearest first with a fix, newest first without', () {
    final far = Incident.fromJson({...row(id: 'far'), 'lat': 31.9, 'created_at': '2026-01-02T10:00:00Z'})!;
    final near = Incident.fromJson(row(id: 'near'))!;
    expect(sortIncidents([far, near], const LatLng(31.5, 74.3)).map((e) => e.id), ['near', 'far']);
    expect(sortIncidents([near, far], null).map((e) => e.id), ['far', 'near']);
  });

  test('report values are range checked per kind', () {
    expect(validReportValue('fare', 450), isTrue);
    expect(validReportValue('fare', 20001), isFalse);
    expect(validReportValue('delay', 241), isFalse);
    expect(validReportValue('delay', 0), isFalse);
    expect(validReportValue('fare', null), isFalse);
  });

  test('stats parse and reject unknown modes', () {
    expect(TransitStat.fromJson({'kind': 'fare', 'mode': 'taxi', 'n': 9, 'median': 500, 'p25': 400, 'p75': 600})!.median, 500);
    expect(TransitStat.fromJson({'kind': 'fare', 'mode': 'hoverboard', 'n': 9, 'median': 1, 'p25': 1, 'p75': 1}), isNull);
  });

  test('authed mints a token once, sends it as Bearer, and re-mints after a 401', () async {
    final calls = <String>[];
    final tokens = MemTokens();
    var minted = 0;
    var first401 = true;
    final api = ApiClient(
      tokens: tokens,
      base: 'https://x.test/api',
      send: (method, url, headers, body) async {
        calls.add('$method ${url.queryParameters['op']} ${headers['authorization'] ?? '-'}');
        if (url.queryParameters['op'] == 'session') return http.Response(jsonEncode({'token': 't${++minted}'}), 200, headers: {'content-type': 'application/json'});
        if (first401) { first401 = false; return http.Response(jsonEncode({'error': 'bad_token'}), 401); }
        return http.Response(jsonEncode({'ok': true}), 200);
      },
    );
    final r = ReportsApi(api);
    await r.confirm('abc');
    expect(calls, ['POST session -', 'POST act Bearer t1', 'POST session -', 'POST act Bearer t2']);
    await r.flag('abc');
    expect(calls.last, 'POST act Bearer t2');
  });

  test('error codes and unreachable backend map to ApiError', () async {
    final api = ApiClient(
      tokens: MemTokens()..t = 'x',
      send: (m, u, h, b) async => u.queryParameters['op'] == 'create' ? http.Response(jsonEncode({'error': 'duplicate_report'}), 409) : throw Exception('offline'),
    );
    await expectLater(ReportsApi(api).submitIncident(category: 'hazard', title: 'abc', at: const LatLng(31, 74)), throwsA(isA<ApiError>().having((e) => e.code, 'code', 'duplicate_report')));
    await expectLater(ReportsApi(api).listIncidents(), throwsA(isA<ApiError>().having((e) => e.code, 'code', 'no_backend')));
  });

  test('transit stats are requested with the city as a query parameter', () async {
    Uri? seen;
    final api = ApiClient(send: (m, u, h, b) async { seen = u; return http.Response(jsonEncode({'stats': []}), 200); }, tokens: MemTokens());
    await ReportsApi(api).transitStats('lahore');
    expect(seen!.queryParameters, {'op': 'transit_stats', 'city': 'lahore'});
  });

  test('mobile strings: every key exists in en, ur and pa; no placeholder is lost', () {
    for (final table in [appStrings, webStrings]) {
      final en = table['en']!;
      for (final l in ['ur', 'pa']) {
        expect(table[l]!.keys.toSet(), en.keys.toSet(), reason: '$l keys');
        for (final k in en.keys) {
          for (final ph in RegExp(r'\{\w+\}').allMatches(en[k]!).map((m) => m.group(0)!)) {
            expect(table[l]![k]!.contains(ph), isTrue, reason: '$l.$k lost $ph');
          }
        }
      }
    }
    expect(tr('pa', 'legalNotice1'), isNot(tr('en', 'legalNotice1')));
    expect(tr('en', 'catAccident'), 'Accident');
  });
}

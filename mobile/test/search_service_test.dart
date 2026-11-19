import 'dart:io';

import 'package:buraq_mobile/core/geo.dart';
import 'package:buraq_mobile/services/search_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('parses places', () async {
    final s = SearchService(api: null, client: MockClient((_) async => http.Response('[{"place_id":1,"lat":"31.5","lon":"74.3","display_name":"Badshahi Mosque, Lahore, Punjab"}]', 200)));
    final r = await s.search('badshahi');
    expect(r!.single.name, 'Badshahi Mosque');
  });
  test('uses our API first (Geoapify behind it), with a rounded bias point', () async {
    final seen = <Uri>[];
    final s = SearchService(api: 'https://example.test/api', client: MockClient((req) async {
      seen.add(req.url);
      return http.Response('{"results":[{"id":"ga_1","name":"Liberty Market","detail":"Gulberg III, Lahore","lat":31.511,"lng":74.343}]}', 200);
    }));
    final r = await s.search('liberty', near: const LatLng(31.5204, 74.3587), lang: 'ur');
    expect(r!.single.detail, 'Gulberg III, Lahore');
    expect(seen.single.queryParameters, {'op': 'geocode', 'q': 'liberty', 'lang': 'ur', 'near': '31.5,74.4'});
  });
  test('falls back to Nominatim when our API is not available', () async {
    final hosts = <String>[];
    final s = SearchService(api: 'https://example.test/api', client: MockClient((req) async {
      hosts.add(req.url.host);
      if (req.url.host == 'example.test') return http.Response('{"error":"geocode_disabled"}', 404);
      return http.Response('[{"place_id":1,"lat":"31.5","lon":"74.3","display_name":"Badshahi Mosque, Lahore, Punjab"}]', 200);
    }));
    expect((await s.search('badshahi'))!.single.name, 'Badshahi Mosque');
    expect(hosts, ['example.test', 'nominatim.openstreetmap.org']);
  });
  test('a rate limit is reported as busy, not offline or empty', () async {
    final s = SearchService(api: null, client: MockClient((_) async => http.Response('', 429)));
    await expectLater(s.search('lahore'), throwsA(isA<SearchException>().having((e) => e.busy, 'busy', true)));
  });
  test('a socket failure is reported as offline, after one retry', () async {
    var calls = 0;
    final s = SearchService(api: null, client: MockClient((_) async { calls++; throw const SocketException('x'); }));
    await expectLater(s.search('lahore'), throwsA(isA<SearchException>().having((e) => e.busy, 'busy', false)));
    expect(calls, 2);
  });
  test('retry succeeds after one transient failure', () async {
    var calls = 0;
    final s = SearchService(api: null, client: MockClient((_) async {
      if (calls++ == 0) throw const SocketException('x');
      return http.Response('[]', 200);
    }));
    expect(await s.search('lahore'), isEmpty);
  });
}

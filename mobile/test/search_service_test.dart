import 'dart:io';

import 'package:buraq_mobile/services/search_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('parses places', () async {
    final s = SearchService(client: MockClient((_) async => http.Response('[{"place_id":1,"lat":"31.5","lon":"74.3","display_name":"Badshahi Mosque, Lahore, Punjab"}]', 200)));
    final r = await s.search('badshahi');
    expect(r!.single.name, 'Badshahi Mosque');
  });
  test('a rate limit is reported as busy, not offline or empty', () async {
    final s = SearchService(client: MockClient((_) async => http.Response('', 429)));
    await expectLater(s.search('lahore'), throwsA(isA<SearchException>().having((e) => e.busy, 'busy', true)));
  });
  test('a socket failure is reported as offline, after one retry', () async {
    var calls = 0;
    final s = SearchService(client: MockClient((_) async { calls++; throw const SocketException('x'); }));
    await expectLater(s.search('lahore'), throwsA(isA<SearchException>().having((e) => e.busy, 'busy', false)));
    expect(calls, 2);
  });
  test('retry succeeds after one transient failure', () async {
    var calls = 0;
    final s = SearchService(client: MockClient((_) async {
      if (calls++ == 0) throw const SocketException('x');
      return http.Response('[]', 200);
    }));
    expect(await s.search('lahore'), isEmpty);
  });
}

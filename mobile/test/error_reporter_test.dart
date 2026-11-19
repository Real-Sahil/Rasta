import 'dart:convert';

import 'package:buraq_mobile/services/error_reporter.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('a report never contains coordinates or query strings', () async {
    final sent = <Map<String, dynamic>>[];
    final r = ErrorReporter(platform: 'android', post: (_, b) async => sent.add(jsonDecode(b) as Map<String, dynamic>));
    await r.report('caught', StateError('no route from 31.520412,74.358712 via https://x/search?q=liberty+chowk&limit=6'),
        StackTrace.fromString('#0 at 31.5204 74.3587'), 'routing');
    final body = jsonEncode(sent.single);
    expect(body, isNot(contains('31.52')));
    expect(body, isNot(contains('74.35')));
    expect(body, isNot(contains('liberty')));
    expect(sent.single['platform'], 'android');
    expect(sent.single['kind'], 'caught');
    expect(sent.single['message'], startsWith('[routing] StateError'));
  });

  test('de-duplicated and capped at 10 per session; never throws', () async {
    var n = 0;
    final r = ErrorReporter(platform: 'ios', post: (_, _) async => n++);
    await r.report('flutter', 'same');
    await r.report('flutter', 'same');
    for (var i = 0; i < 20; i++) {
      await r.report('flutter', 'err $i');
    }
    expect(n, ErrorReporter.maxPerSession);
    final broken = ErrorReporter(platform: 'ios', post: (_, _) async => throw Exception('offline'));
    await broken.report('flutter', 'x'); // must not throw
  });

  test('the default reporter is off (tests and debug builds post nothing)', () => expect(errorReporter.enabled, isFalse));
}

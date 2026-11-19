import 'dart:convert';

import 'package:buraq_mobile/core/navigation.dart';
import 'package:buraq_mobile/core/geo.dart';
import 'package:buraq_mobile/core/routing.dart';
import 'package:buraq_mobile/services/gps_service.dart';
import 'package:buraq_mobile/services/search_service.dart';
import 'package:buraq_mobile/services/speech_service.dart';
import 'package:buraq_mobile/state/app_state.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

// A route 1.1 km east then 0.9 km north.
const a = [74.3100, 31.5600], b = [74.3205, 31.5600], c = [74.3205, 31.5682];
final osrm = {
  'code': 'Ok',
  'routes': [
    {
      'distance': 2000, 'duration': 240,
      'geometry': {'coordinates': [a, b, c]},
      'legs': [
        {
          'steps': [
            {'maneuver': {'type': 'depart', 'location': a}, 'name': 'Mall Road', 'distance': 1100, 'duration': 130},
            {'maneuver': {'type': 'turn', 'modifier': 'left', 'location': b}, 'name': 'Canal Road', 'distance': 900, 'duration': 110},
            {'maneuver': {'type': 'arrive', 'location': c}, 'name': '', 'distance': 0, 'duration': 0},
          ]
        }
      ]
    }
  ]
};

class _FakeSpeech extends SpeechService {
  final spoken = <String>[];
  @override
  Future<void> init() async {}
  @override
  Future<void> stop() async {}
  // ignore: avoid_renaming_method_parameters
  @override
  Future<void> speak(announcement, lang, {bool force = false, DateTime? now}) async => spoken.add(announcement.key);
}

class _FakeGps extends GpsService {
  bool started = false, background = false;
  @override
  void start({bool background = false, required void Function(Fix) onFix, required void Function(Object) onError, String notificationTitle = '', String notificationText = ''}) {
    started = true;
    this.background = background;
  }

  @override
  void stop() => started = false;
}

void main() {
  const dest = Place(id: 'd1', name: 'Canal Road', detail: '', point: LatLng(31.5682, 74.3205));
  Future<http.Response> ok(Uri _) async => http.Response(jsonEncode(osrm), 200);

  test('no fix: a route is not invented, a notice is shown', () async {
    clearRouteCache();
    final app = AppState(gps: _FakeGps(), speech: _FakeSpeech(), get: ok);
    await app.setDestination(dest);
    expect(app.routes, isEmpty);
    expect(app.noticeKey, 'noFix');
  });

  test('with a fix: route loads, navigation starts, speaks, and reaches arrival', () async {
    clearRouteCache();
    final gps = _FakeGps();
    final speech = _FakeSpeech();
    final app = AppState(gps: gps, speech: speech, get: ok);
    app.onFix(const Fix(lat: 31.56, lng: 74.31, accuracy: 8));
    await app.setDestination(dest);
    expect(app.routes, hasLength(1));
    expect(app.startNavigation(), isNull);
    expect(app.navigating, isTrue);
    expect(gps.background, isTrue, reason: 'background GPS only while navigating');
    // drive east then north in small hops
    for (var i = 1; i <= 30; i++) {
      app.onFix(Fix(lat: 31.56, lng: 74.31 + 0.0105 * i / 30, accuracy: 8));
    }
    for (var i = 1; i <= 30; i++) {
      app.onFix(Fix(lat: 31.56 + 0.0082 * i / 30, lng: 74.3205, accuracy: 8));
    }
    expect(app.session!.status, NavStatus.arrived);
    expect(speech.spoken.any((k) => k.endsWith(':arrived')), isTrue);
    expect(speech.spoken.where((k) => k.endsWith(':500')), isNotEmpty);
    app.clear();
    expect(app.navigating, isFalse);
    expect(gps.background, isFalse);
  });

  test('a custom start is a preview only', () async {
    clearRouteCache();
    final app = AppState(gps: _FakeGps(), speech: _FakeSpeech(), get: ok);
    app.onFix(const Fix(lat: 31.56, lng: 74.31));
    await app.setDestination(dest);
    await app.setOrigin(const Place(id: 'o1', name: 'Somewhere', detail: '', point: LatLng(31.561, 74.311)));
    expect(app.startNavigation(), 'previewOnly');
    expect(app.navigating, isFalse);
  });

  test('glitch filter rejects a >1.2 km jump within 2 s only', () {
    const last = Fix(lat: 31.56, lng: 74.31);
    final t = DateTime(2026, 1, 1, 10, 0, 0);
    const far = Fix(lat: 31.58, lng: 74.31); // ~2.2 km
    expect(isGlitch(last, t, far, t.add(const Duration(seconds: 1))), isTrue);
    expect(isGlitch(last, t, far, t.add(const Duration(seconds: 30))), isFalse);
    expect(isGlitch(null, null, far, t), isFalse);
  });
}

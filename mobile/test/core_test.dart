import 'dart:convert';

import 'package:buraq_mobile/core/announcer.dart';
import 'package:buraq_mobile/core/geo.dart';
import 'package:buraq_mobile/core/navigation.dart';
import 'package:buraq_mobile/core/phrases.dart';
import 'package:buraq_mobile/core/route.dart';
import 'package:buraq_mobile/core/route_matcher.dart';
import 'package:buraq_mobile/core/routing.dart';
import 'package:buraq_mobile/core/share_trip.dart';
import 'package:buraq_mobile/core/voice.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

// A ~2 km straight route heading north along lng 74.35, with 3 steps.
final path = List.generate(21, (i) => LatLng(31.5 + i * 0.0009, 74.35));
final totalM = cumulativeLengths(path).last;
final route = RouteOption(
  id: 'r1', title: 't', titleUrdu: 't', via: '', viaUrdu: '', distanceKm: totalM / 1000, durationMinutes: 6,
  isRecommended: true, path: path,
  steps: const [
    NavStep(instruction: 'Head north', instructionUrdu: 'شمال', distanceMeters: 1000, durationSeconds: 100, maneuver: 'straight'),
    NavStep(instruction: 'Turn left', instructionUrdu: 'بائیں', distanceMeters: 600, durationSeconds: 60, maneuver: 'turn-left'),
    NavStep(instruction: 'Arrive', instructionUrdu: 'پہنچیں', distanceMeters: 400, durationSeconds: 40, maneuver: 'arrive'),
  ],
);

Fix at(double m, {double dx = 0, double? accuracy}) {
  final lat = 31.5 + m / 111195;
  return Fix(lat: lat, lng: 74.35 + dx / (111195 * 0.8532), accuracy: accuracy); // cos(31.5 deg) ~ 0.8526
}

void main() {
  group('geo', () {
    test('haversine ~111 km per degree of latitude', () {
      expect(haversineM(const LatLng(0, 0), const LatLng(1, 0)), closeTo(111195, 100));
    });
    test('bearing north/east', () {
      expect(bearingDeg(const LatLng(0, 0), const LatLng(1, 0)), closeTo(0, 0.001));
      expect(bearingDeg(const LatLng(0, 0), const LatLng(0, 1)), closeTo(90, 0.001));
    });
    test('projects onto a segment with clamping', () {
      final p = projectOnSegment(const LatLng(0.0005, 0.0003), const LatLng(0, 0), const LatLng(0.001, 0));
      expect(p.t, closeTo(0.5, 0.01));
      expect(p.distM, closeTo(33.4, 0.5));
      expect(projectOnSegment(const LatLng(-1, 0), const LatLng(0, 0), const LatLng(1, 0)).t, 0);
    });
  });

  group('matchToRoute', () {
    final cum = cumulativeLengths(path);
    test('matches mid-segment on a sparse polyline', () {
      final sparse = [path.first, path.last];
      final m = matchToRoute(sparse, cumulativeLengths(sparse), at(900, dx: 5).point)!;
      expect(m.distFromRouteM, lessThan(6));
      expect(m.alongM, closeTo(900, 10));
    });
    test('does not jump ahead on a loop that overlaps itself', () {
      final loop = [...path.sublist(0, 11), ...path.sublist(0, 11).reversed];
      final c = cumulativeLengths(loop);
      final m = matchToRoute(loop, c, at(500).point, lastAlongM: 480)!;
      expect(m.alongM, lessThan(c[10] + 1));
    });
    test('recovers via global search after leaving the window', () {
      final m = matchToRoute(path, cum, at(1700).point)!;
      expect(m.alongM, closeTo(1700, 10));
    });
  });

  group('navigation session', () {
    test('tracks progress, remaining distance, ETA and step', () {
      var s = createSession(route);
      s = updateSession(s, route, at(300));
      expect(s.status, NavStatus.navigating);
      expect(s.alongM, closeTo(300, 10));
      expect(s.remainingM, closeTo(totalM - 300, 10));
      expect(s.remainingS, lessThan(6 * 60));
      expect(s.stepIndex, 0);
      expect(s.upcomingStepIndex, 1);
      final d1 = s.distanceToManeuverM;
      s = updateSession(s, route, at(600));
      expect(s.distanceToManeuverM, lessThan(d1));
    });
    test('advances to the next step after the manoeuvre point', () {
      var s = createSession(route);
      s = updateSession(s, route, at(0.55 * totalM));
      expect(s.stepIndex, 1);
      expect(s.upcomingStepIndex, 2);
    });
    test('snaps the vehicle onto the route and drops the snap when off route', () {
      var s = createSession(route);
      expect(s.snapped, isNull);
      s = updateSession(s, route, at(300, dx: 12));
      expect(s.snapped, isNotNull);
      expect(s.snapped!.lng, closeTo(74.35, 0.00001));
      for (var i = 0; i < 3; i++) {
        s = updateSession(s, route, at(400, dx: 300));
      }
      expect(s.status, NavStatus.offRoute);
      expect(s.snapped, isNull);
    });
    test('never moves progress backwards', () {
      var s = createSession(route);
      s = updateSession(s, route, at(800));
      final a = s.alongM;
      s = updateSession(s, route, at(780));
      expect(s.alongM, a);
    });
    test('flags off-route only after 3 consecutive fixes, and recovers', () {
      var s = createSession(route);
      for (var i = 0; i < 2; i++) {
        s = updateSession(s, route, at(500, dx: 200));
      }
      expect(s.status, NavStatus.navigating);
      s = updateSession(s, route, at(500, dx: 200));
      expect(s.status, NavStatus.offRoute);
      s = updateSession(s, route, at(520, dx: 3));
      expect(s.status, NavStatus.navigating);
      expect(s.offRouteCount, 0);
    });
    test('tolerates poor GPS accuracy', () {
      var s = createSession(route);
      for (var i = 0; i < 5; i++) {
        s = updateSession(s, route, at(500, dx: 90, accuracy: 120));
      }
      expect(s.status, NavStatus.navigating);
    });
    test('arrives within 25 m of the destination and is terminal', () {
      var s = createSession(route);
      s = updateSession(s, route, at(totalM - 10));
      expect(s.status, NavStatus.arrived);
      expect(s.remainingM, 0);
      expect(identical(updateSession(s, route, at(100)), s), isTrue);
    });
  });

  group('announcer', () {
    test('speaks each band once per manoeuvre', () {
      final s = createSession(route).copyWith(upcomingStepIndex: 1, distanceToManeuverM: 480);
      final seen = <String>{};
      final a1 = nextAnnouncement(s, route, seen)!;
      expect(a1.en, 'In 500 meters, Turn left');
      expect(a1.phrase, 'turn-left');
      expect(a1.distanceM, 500);
      expect(a1.ur, '500 میٹر بعد، بائیں مڑیں');
      expect(a1.pa, contains('کھبے مڑو'));
      seen.add(a1.key);
      expect(nextAnnouncement(s, route, seen), isNull);
      final a2 = nextAnnouncement(s.copyWith(distanceToManeuverM: 150), route, seen)!;
      expect(a2.key, contains(':200'));
      expect(a2.distanceM, 200);
      final a3 = nextAnnouncement(s.copyWith(distanceToManeuverM: 30), route, <String>{})!;
      expect(a3.en, 'Turn left');
      expect(a3.distanceM, isNull);
    });
    test('is silent when far away or off-route, announces arrival once', () {
      final s = createSession(route).copyWith(distanceToManeuverM: 1500);
      expect(nextAnnouncement(s, route, <String>{}), isNull);
      expect(nextAnnouncement(s.copyWith(status: NavStatus.offRoute, distanceToManeuverM: 10), route, <String>{}), isNull);
      final arrived = s.copyWith(status: NavStatus.arrived);
      final a = nextAnnouncement(arrived, route, <String>{})!;
      expect(a.phrase, 'arrived');
      expect(nextAnnouncement(arrived, route, {a.key}), isNull);
    });
  });

  group('routing', () {
    const req = RouteRequest(from: LatLng(31.5, 74.3), to: LatLng(31.55, 74.35), destId: 'd1', mode: TravelMode.driving);
    final osrm = {
      'code': 'Ok',
      'routes': [
        {
          'distance': 7200, 'duration': 780,
          'geometry': {'coordinates': [[74.3, 31.5], [74.32, 31.52], [74.35, 31.55]]},
          'legs': [
            {
              'steps': [
                {'maneuver': {'type': 'depart'}, 'name': 'A Rd', 'distance': 4000, 'duration': 400},
                {'maneuver': {'type': 'turn', 'modifier': 'right'}, 'name': 'B Rd', 'distance': 3200, 'duration': 380},
                {'maneuver': {'type': 'arrive'}, 'name': '', 'distance': 0, 'duration': 0},
              ]
            }
          ]
        }
      ]
    };
    http.Response ok() => http.Response(jsonEncode(osrm), 200);

    test('builds distinct ids per destination and mode', () {
      final a = parseOsrmRoutes(osrm, req).first;
      final b = parseOsrmRoutes(osrm, const RouteRequest(from: LatLng(31.5, 74.3), to: LatLng(31.55, 74.35), destId: 'd2', mode: TravelMode.driving)).first;
      expect(a.id, isNot(b.id));
      expect(a.distanceKm, 7.2);
      expect(a.steps[1].instruction, 'Turn right onto B Rd');
      expect(a.steps[1].maneuver, 'turn-right');
    });
    test('rejects malformed responses', () {
      expect(parseOsrmRoutes({'code': 'NoRoute'}, req), isEmpty);
      expect(parseOsrmRoutes({'code': 'Ok', 'routes': [{'distance': 1}]}, req), isEmpty);
      expect(parseOsrmRoutes(null, req), isEmpty);
    });
    test('uses the foot server for walking', () {
      expect(buildOsrmUrl(const RouteRequest(from: LatLng(31.5, 74.3), to: LatLng(31.55, 74.35), destId: 'd1', mode: TravelMode.walking)), contains('routed-foot'));
      expect(buildOsrmUrl(req), contains('router.project-osrm.org'));
    });
    test('estimate has consistent geometry/step totals', () {
      final r = estimateRoute(req);
      expect(r.steps.fold<int>(0, (s, x) => s + x.distanceMeters), (r.distanceKm * 1000).round());
    });
    test('fetchRoutes returns network routes, else an estimate', () async {
      clearRouteCache();
      expect((await fetchRoutes(req, get: (_) async => ok())).source, RouteSource.network);
      clearRouteCache();
      final r = await fetchRoutes(req, get: (_) async => throw Exception('offline'));
      expect(r.source, RouteSource.estimate);
      expect(r.routes, hasLength(1));
      expect((await fetchRoutes(req, get: (_) async => http.Response('', 500))).source, RouteSource.estimate);
    });
    test('fails over to the next server, then caches the result', () async {
      clearRouteCache();
      final urls = <String>[];
      Future<http.Response> f(Uri u) async {
        urls.add(u.toString());
        return urls.length == 1 ? http.Response('', 429) : ok();
      }

      final r = await fetchRoutes(req, get: f);
      expect(r.source, RouteSource.network);
      expect(urls, hasLength(2));
      expect(urls[0], isNot(urls[1]));
      await fetchRoutes(req, get: f); // served from cache
      expect(urls, hasLength(2));
    });
    test('propagates caller cancellation', () async {
      clearRouteCache();
      await expectLater(fetchRoutes(req, get: (_) async => ok(), isCancelled: () => true), throwsA(isA<RouteCancelled>()));
    });
  });

  group('voice', () {
    test('english prefers en-GB, urdu uses ur-PK, punjabi falls back to an urdu voice (approximate)', () {
      expect(chooseVoice(VoiceLang.en, const [VoiceInfo('en-US'), VoiceInfo('en-GB')]).langTag, 'en-GB');
      expect(chooseVoice(VoiceLang.ur, const [VoiceInfo('ur-PK')]).status, VoiceStatus.ok);
      expect(chooseVoice(VoiceLang.pa, const [VoiceInfo('ur-PK'), VoiceInfo('pa-IN')]).status, VoiceStatus.approximate);
      expect(chooseVoice(VoiceLang.pa, const [VoiceInfo('pa-IN')]).status, VoiceStatus.none);
      expect(chooseVoice(VoiceLang.pa, const [VoiceInfo('pa_PK')]).status, VoiceStatus.ok);
      expect(chooseVoice(VoiceLang.ur, const []).status, VoiceStatus.none);
    });
    test('phrase catalogue is complete in all languages', () {
      for (final k in phraseKeys) {
        for (final l in VoiceLang.values) {
          expect(renderPhrase(k, l), isNotEmpty);
        }
      }
    });
  });

  test('trip sharing fills destination, ETA and a map link', () {
    final now = DateTime(2026, 1, 1, 10, 0, 0);
    final txt = buildTripShareText('To {dest}, arriving {eta}. {link}', dest: 'Badshahi Mosque', remainingS: 15 * 60, pos: const LatLng(31.5, 74.35), now: now);
    expect(txt, 'To Badshahi Mosque, arriving 10:15. ${osmLink(const LatLng(31.5, 74.35))}');
    expect(osmLink(const LatLng(31.5, 74.35)), contains('mlat=31.50000&mlon=74.35000'));
  });
}

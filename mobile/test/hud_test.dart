import 'package:buraq_mobile/core/announcer.dart';
import 'package:buraq_mobile/core/geo.dart';
import 'package:buraq_mobile/core/hud.dart';
import 'package:buraq_mobile/core/navigation.dart';
import 'package:buraq_mobile/core/phrases.dart';
import 'package:buraq_mobile/core/route.dart';
import 'package:flutter_test/flutter_test.dart';

NavStep st(String m, int d) => NavStep(instruction: '', instructionUrdu: '', distanceMeters: d, durationSeconds: 10, maneuver: m);
RouteOption rt(List<NavStep> steps) => RouteOption(
      id: 'r', title: '', titleUrdu: '', via: '', viaUrdu: '', distanceKm: 1, durationMinutes: 5, isRecommended: true,
      path: const [LatLng(31.5, 74.3), LatLng(31.5, 74.3105)], steps: steps);
NavSession at(NavSession s, int i) => s.copyWith(stepIndex: i, upcomingStepIndex: i + 1);
Announcement ann(String key) => Announcement(key: key, phrase: 'start', distanceM: null, en: '', ur: '', pa: '');

void main() {
  test('then: names a close following turn, quiet otherwise', () {
    final close = rt([st('straight', 500), st('turn-left', 150), st('turn-right', 350)]);
    expect(thenPhrase(at(createSession(close), 0), close), 'turn-right');
    final far = rt([st('straight', 300), st('turn-left', 600), st('turn-right', 100)]);
    expect(thenPhrase(at(createSession(far), 0), far), isNull);
    final straight = rt([st('straight', 500), st('turn-left', 100), st('straight', 400)]);
    expect(thenPhrase(at(createSession(straight), 0), straight), isNull);
    expect(thenPhrase(at(createSession(close), 0).copyWith(status: NavStatus.offRoute), close), isNull);
    expect(thenText('turn-right', VoiceLang.en, 'Then'), 'Then turn right');
  });

  test('progress runs from 0 to 1', () {
    final s = createSession(rt([st('arrive', 1000)]));
    expect(tripProgress(s), 0);
    expect(tripProgress(s.copyWith(alongM: s.totalM / 2)), closeTo(0.5, 1e-9));
    expect(tripProgress(s.copyWith(status: NavStatus.arrived)), 1);
  });

  test('haptics only for the 200 m warning and arrival', () {
    expect(hapticFor(ann('r:3:200')), HapticCue.turn);
    expect(hapticFor(ann('r:3:500')), isNull);
    expect(hapticFor(ann('r:arrived')), HapticCue.arrive);
    expect(hapticFor(ann('r:start')), isNull);
  });
}

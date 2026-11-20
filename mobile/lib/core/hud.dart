// Port of src/core/hud.ts: the "then …" line, trip progress and haptic cues. Keep both in step.
import 'announcer.dart';
import 'navigation.dart';
import 'phrases.dart';
import 'route.dart';

/// "Then …" appears only when the manoeuvre after the next one comes this soon after it.
const double kThenMaxGapM = 300;

/// The manoeuvre after the upcoming one when it follows closely; plain "continue straight" is skipped.
String? thenPhrase(NavSession s, RouteOption r) {
  if (s.status != NavStatus.navigating) return null;
  final i = s.upcomingStepIndex;
  if (i + 1 >= r.steps.length || i <= s.stepIndex) return null;
  final end = i < s.stepEndsM.length ? s.stepEndsM[i] : double.infinity;
  final start = s.stepIndex < s.stepEndsM.length ? s.stepEndsM[s.stepIndex] : 0.0;
  if (!(end - start <= kThenMaxGapM)) return null;
  final key = phraseForManeuver(r.steps[i + 1].maneuver);
  return key == 'straight' ? null : key;
}

String thenText(String key, VoiceLang lang, String thenWord) {
  final p = renderPhrase(key, lang);
  return '$thenWord ${lang == VoiceLang.en && p.isNotEmpty ? p[0].toLowerCase() + p.substring(1) : p}';
}

/// Share of the trip driven, 0..1, for the progress bar.
double tripProgress(NavSession s) {
  if (s.status == NavStatus.arrived) return 1;
  if (!(s.totalM > 0)) return 0;
  return (s.alongM / s.totalM).clamp(0.0, 1.0);
}

enum HapticCue { turn, arrive, confirm }

/// A buzz for the 200 m warning and for arrival; every other prompt is voice only.
HapticCue? hapticFor(Announcement a) {
  if (a.key.endsWith(':200')) return HapticCue.turn;
  if (a.key.endsWith(':arrived')) return HapticCue.arrive;
  return null;
}

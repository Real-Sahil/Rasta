import 'phrases.dart';

/// Mirrors dialProgress/posterWord in src/components/SkinHuds.tsx; keep the two in step.
/// Fraction of the final [bandM] metres already covered: 0 far away, 1 at the turn.
double dialProgress(double distanceToManeuverM, [double bandM = 500]) => 1 - (distanceToManeuverM / bandM).clamp(0.0, 1.0);

/// The turn word shown at poster size. Urdu/Punjabi users get their own language, everyone else English.
/// Wording is a DRAFT pending native-speaker review.
String posterWord(String maneuver, String lang) {
  final v = lang == 'ur' ? VoiceLang.ur : (lang == 'pa' ? VoiceLang.pa : VoiceLang.en);
  return phrases[phraseForManeuver(maneuver)]![v]!;
}

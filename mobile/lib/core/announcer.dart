import 'navigation.dart';
import 'phrases.dart';
import 'route.dart';

/// One spoken prompt. [phrase] + [distanceM] identify it; en/ur/pa are the text for the phone's TTS voice.
class Announcement {
  const Announcement({required this.key, required this.phrase, required this.distanceM, required this.en, required this.ur, required this.pa});
  final String key;
  final String phrase;
  final int? distanceM;
  final String en;
  final String ur;
  final String pa;

  String textFor(VoiceLang l) => switch (l) { VoiceLang.en => en, VoiceLang.ur => ur, VoiceLang.pa => pa };
}

const List<int> announceBandsM = [500, 200, 50];

/// A prompt with no distance, e.g. "Starting navigation", "Route recalculated", "You have arrived".
Announcement simpleAnnouncement(String key, String phrase, {String? enOverride}) => Announcement(
      key: key,
      phrase: phrase,
      distanceM: null,
      en: enOverride ?? renderPhrase(phrase, VoiceLang.en),
      ur: renderPhrase(phrase, VoiceLang.ur),
      pa: renderPhrase(phrase, VoiceLang.pa),
    );

/// The prompt for a route step at a spoken distance. English keeps the road name from the router.
Announcement stepAnnouncement(String key, NavStep step, int? distanceM) {
  final phrase = phraseForManeuver(step.maneuver);
  final en = (distanceM != null ? 'In $distanceM meters, ' : '') + (step.instruction.isNotEmpty ? step.instruction : renderPhrase(phrase, VoiceLang.en));
  return Announcement(
    key: key,
    phrase: phrase,
    distanceM: distanceM,
    en: en,
    ur: renderPhrase(phrase, VoiceLang.ur, distanceM),
    pa: renderPhrase(phrase, VoiceLang.pa, distanceM),
  );
}

/// Decide whether a spoken prompt is due. Each (manoeuvre, band) pair is spoken once; [announced] holds the keys
/// already spoken this trip. The band (500 / 200) is spoken, not the exact distance.
Announcement? nextAnnouncement(NavSession session, RouteOption route, Set<String> announced) {
  if (session.status == NavStatus.arrived) {
    final key = '${route.id}:arrived';
    return announced.contains(key) ? null : simpleAnnouncement(key, 'arrived');
  }
  if (session.status != NavStatus.navigating) return null;
  if (session.upcomingStepIndex >= route.steps.length) return null;
  final step = route.steps[session.upcomingStepIndex];
  final d = session.distanceToManeuverM;
  final bands = [...announceBandsM]..sort();
  final band = bands.cast<int?>().firstWhere((b) => d <= b!, orElse: () => null);
  if (band == null) return null;
  final key = '${route.id}:${session.upcomingStepIndex}:$band';
  if (announced.contains(key)) return null;
  return stepAnnouncement(key, step, spokenDistancesM.contains(band) ? band : null);
}

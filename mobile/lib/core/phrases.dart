// Spoken-direction catalogue: one short phrase per manoeuvre in English, Urdu and Punjabi (Shahmukhi).
// !! The Urdu and Punjabi wording is a DRAFT and must be reviewed by a native speaker before release.
//    Mirrors src/core/phrases.ts in the web app; keep the two in step.

enum VoiceLang { en, ur, pa }

const List<String> phraseKeys = [
  'turn-left', 'turn-right', 'straight', 'u-turn', 'roundabout', 'merge', 'arrive', 'depart', 'start', 'reroute', 'arrived'
];

const Map<String, Map<VoiceLang, String>> phrases = {
  'turn-left': {VoiceLang.en: 'Turn left', VoiceLang.ur: 'بائیں مڑیں', VoiceLang.pa: 'کھبے مڑو'},
  'turn-right': {VoiceLang.en: 'Turn right', VoiceLang.ur: 'دائیں مڑیں', VoiceLang.pa: 'سجے مڑو'},
  'straight': {VoiceLang.en: 'Continue straight', VoiceLang.ur: 'سیدھا چلیں', VoiceLang.pa: 'سدھے جاؤ'},
  'u-turn': {VoiceLang.en: 'Make a U-turn', VoiceLang.ur: 'یو ٹرن لیں', VoiceLang.pa: 'یو ٹرن لوو'},
  'roundabout': {VoiceLang.en: 'Enter the roundabout', VoiceLang.ur: 'چوراہے میں داخل ہوں', VoiceLang.pa: 'چوک وچ داخل ہوو'},
  'merge': {VoiceLang.en: 'Merge', VoiceLang.ur: 'سڑک میں شامل ہوں', VoiceLang.pa: 'سڑک وچ شامل ہوو'},
  'arrive': {VoiceLang.en: 'Your destination is ahead', VoiceLang.ur: 'آپ کی منزل سامنے ہے', VoiceLang.pa: 'تہاڈی منزل سامنے اے'},
  'depart': {VoiceLang.en: 'Head out', VoiceLang.ur: 'روانہ ہوں', VoiceLang.pa: 'ٹر پوو'},
  'start': {VoiceLang.en: 'Starting navigation', VoiceLang.ur: 'نیویگیشن شروع ہو رہی ہے', VoiceLang.pa: 'نیویگیشن شروع ہو رہی اے'},
  'reroute': {VoiceLang.en: 'Route recalculated', VoiceLang.ur: 'راستہ دوبارہ طے کیا گیا', VoiceLang.pa: 'نواں راہ بنایا گیا'},
  'arrived': {VoiceLang.en: 'You have arrived at your destination', VoiceLang.ur: 'آپ اپنی منزل پر پہنچ گئے ہیں', VoiceLang.pa: 'تسی اپنی منزل تے پہنچ گئے او'},
};

/// Distances that get a spoken prefix ("In 500 meters"). Closer than the last band the phrase is spoken alone.
const List<int> spokenDistancesM = [500, 200];

String _prefix(VoiceLang l, int m) => switch (l) {
      VoiceLang.en => 'In $m meters, ',
      VoiceLang.ur => '$m میٹر بعد، ',
      VoiceLang.pa => '$m میٹر پچھوں، ', // DRAFT
    };

String renderPhrase(String key, VoiceLang lang, [int? distanceM]) =>
    (distanceM != null ? _prefix(lang, distanceM) : '') + phrases[key]![lang]!;

/// Map a route step manoeuvre to a phrase key.
String phraseForManeuver(String maneuver) => switch (maneuver) {
      'turn-left' => 'turn-left',
      'turn-right' => 'turn-right',
      'u-turn' => 'u-turn',
      'roundabout' => 'roundabout',
      'merge' => 'merge',
      'arrive' => 'arrive',
      _ => 'straight',
    };

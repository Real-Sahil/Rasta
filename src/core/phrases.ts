/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Spoken-direction catalogue: one short phrase per manoeuvre in English, Urdu and Punjabi (Shahmukhi, the
// Arabic-script Punjabi used in Pakistan). Directions are a small fixed vocabulary, which is what makes
// recorded clips practical: record `PHRASE_KEYS` x languages once (see docs/voice-phrases.md).
//
// !! The Urdu and Punjabi wording is a DRAFT and must be reviewed by a native speaker before release.
//    Wrong or unnatural directions while driving are a safety problem.

export type VoiceLang = 'en' | 'ur' | 'pa';

export type PhraseKey =
  | 'turn-left' | 'turn-right' | 'straight' | 'u-turn' | 'roundabout' | 'merge'
  | 'arrive' | 'depart' | 'start' | 'reroute' | 'arrived';

export const PHRASE_KEYS: PhraseKey[] = [
  'turn-left', 'turn-right', 'straight', 'u-turn', 'roundabout', 'merge', 'arrive', 'depart', 'start', 'reroute', 'arrived'
];

export const PHRASES: Record<PhraseKey, Record<VoiceLang, string>> = {
  'turn-left':  { en: 'Turn left', ur: 'بائیں مڑیں', pa: 'کھبے مڑو' },
  'turn-right': { en: 'Turn right', ur: 'دائیں مڑیں', pa: 'سجے مڑو' },
  straight:     { en: 'Continue straight', ur: 'سیدھا چلیں', pa: 'سدھے جاؤ' },
  'u-turn':     { en: 'Make a U-turn', ur: 'یو ٹرن لیں', pa: 'یو ٹرن لوو' },
  roundabout:   { en: 'Enter the roundabout', ur: 'چوراہے میں داخل ہوں', pa: 'چوک وچ داخل ہوو' },
  merge:        { en: 'Merge', ur: 'سڑک میں شامل ہوں', pa: 'سڑک وچ شامل ہوو' },
  arrive:       { en: 'Your destination is ahead', ur: 'آپ کی منزل سامنے ہے', pa: 'تہاڈی منزل سامنے اے' },
  depart:       { en: 'Head out', ur: 'روانہ ہوں', pa: 'ٹر پوو' },
  start:        { en: 'Starting navigation', ur: 'نیویگیشن شروع ہو رہی ہے', pa: 'نیویگیشن شروع ہو رہی اے' },
  reroute:      { en: 'Route recalculated', ur: 'راستہ دوبارہ طے کیا گیا', pa: 'نواں راہ بنایا گیا' },
  arrived:      { en: 'You have arrived at your destination', ur: 'آپ اپنی منزل پر پہنچ گئے ہیں', pa: 'تسی اپنی منزل تے پہنچ گئے او' }
};

/** Distances that get a spoken prefix ("In 500 meters"). Closer than the last band the phrase is spoken alone ("now"). */
export const SPOKEN_DISTANCES_M = [500, 200] as const;
export type SpokenDistance = (typeof SPOKEN_DISTANCES_M)[number];

const DISTANCE_PREFIX: Record<VoiceLang, (m: number) => string> = {
  en: (m) => `In ${m} meters, `,
  ur: (m) => `${m} میٹر بعد، `,
  pa: (m) => `${m} میٹر پچھوں، ` // DRAFT
};

/** Text for a phrase in one language, optionally prefixed with a distance. */
export function renderPhrase(key: PhraseKey, lang: VoiceLang, distanceM: SpokenDistance | null = null): string {
  return (distanceM ? DISTANCE_PREFIX[lang](distanceM) : '') + PHRASES[key][lang];
}

/** Map a route step manoeuvre to a phrase key. */
export function phraseForManeuver(maneuver: string): PhraseKey {
  switch (maneuver) {
    case 'turn-left': return 'turn-left';
    case 'turn-right': return 'turn-right';
    case 'u-turn': return 'u-turn';
    case 'roundabout': return 'roundabout';
    case 'merge': return 'merge';
    case 'arrive': return 'arrive';
    default: return 'straight';
  }
}

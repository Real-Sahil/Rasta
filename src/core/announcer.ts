/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { RouteOption } from '../types';
import { NavSession } from './navigation';
import { PhraseKey, SpokenDistance, SPOKEN_DISTANCES_M, VoiceLang, phraseForManeuver, renderPhrase } from './phrases';

/** One spoken prompt. `phrase` + `distanceM` let the speech layer use recorded clips; en/ur/pa are the text fallbacks. */
export interface Announcement {
  key: string;
  phrase: PhraseKey;
  distanceM: SpokenDistance | null;
  en: string;
  ur: string;
  pa: string;
}

export const ANNOUNCE_BANDS_M = [500, 200, 50];

export const textFor = (a: Announcement, lang: VoiceLang) => a[lang];

/** A prompt with no distance, e.g. "Starting navigation", "Route recalculated", "You have arrived". */
export function simpleAnnouncement(key: string, phrase: PhraseKey, enOverride?: string): Announcement {
  return { key, phrase, distanceM: null, en: enOverride ?? renderPhrase(phrase, 'en'), ur: renderPhrase(phrase, 'ur'), pa: renderPhrase(phrase, 'pa') };
}

/** The prompt for a route step at a spoken distance. English keeps the road name from the router ("Turn left onto Mall Road"). */
export function stepAnnouncement(key: string, step: RouteOption['steps'][number], distanceM: SpokenDistance | null): Announcement {
  const phrase = phraseForManeuver(step.maneuver);
  const en = (distanceM ? `In ${distanceM} meters, ` : '') + (step.instruction || renderPhrase(phrase, 'en'));
  return { key, phrase, distanceM, en, ur: renderPhrase(phrase, 'ur', distanceM), pa: renderPhrase(phrase, 'pa', distanceM) };
}

/**
 * Decide whether a spoken prompt is due. Each (manoeuvre, band) pair is spoken once;
 * `announced` is the set of keys already spoken for this trip.
 * The band value (500 / 200) is what is spoken, not the exact distance: it keeps the vocabulary small enough to record.
 */
export function nextAnnouncement(
  session: NavSession,
  route: RouteOption,
  announced: ReadonlySet<string>
): Announcement | null {
  if (session.status === 'arrived') {
    const key = `${route.id}:arrived`;
    return announced.has(key) ? null : simpleAnnouncement(key, 'arrived');
  }
  if (session.status !== 'navigating') return null;
  const step = route.steps[session.upcomingStepIndex];
  if (!step) return null;
  const d = session.distanceToManeuverM;
  const band = [...ANNOUNCE_BANDS_M].sort((a, b) => a - b).find((b) => d <= b);
  if (band === undefined) return null;
  const key = `${route.id}:${session.upcomingStepIndex}:${band}`;
  if (announced.has(key)) return null;
  const spoken = (SPOKEN_DISTANCES_M as readonly number[]).includes(band) ? (band as SpokenDistance) : null;
  return stepAnnouncement(key, step, spoken);
}

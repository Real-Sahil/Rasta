/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { RouteOption } from '../types';
import { Announcement } from './announcer';
import { NavSession } from './navigation';
import { PhraseKey, VoiceLang, phraseForManeuver, renderPhrase } from './phrases';

/** "Then …" appears only when the manoeuvre after the next one comes this soon after it. */
export const THEN_MAX_GAP_M = 300;

/**
 * The manoeuvre after the upcoming one, when it follows closely enough to matter ("Turn left, then turn right").
 * Plain "continue straight" is skipped: it adds words without telling the driver anything.
 */
export function thenPhrase(session: NavSession, route: RouteOption): PhraseKey | null {
  if (session.status !== 'navigating') return null;
  const i = session.upcomingStepIndex;
  const next = route.steps[i + 1];
  if (!next || i <= session.stepIndex) return null;
  const gap = (session.stepEndsM[i] ?? Infinity) - (session.stepEndsM[session.stepIndex] ?? 0);
  if (!(gap <= THEN_MAX_GAP_M)) return null;
  const key = phraseForManeuver(next.maneuver);
  return key === 'straight' ? null : key;
}

export const thenText = (key: PhraseKey, lang: VoiceLang, thenWord: string) => `${thenWord} ${renderPhrase(key, lang).replace(/^\S/, (c) => (lang === 'en' ? c.toLowerCase() : c))}`;

/** Share of the trip driven, 0..1, for the progress bar. Never goes backwards because `alongM` doesn't. */
export function tripProgress(session: NavSession): number {
  if (session.status === 'arrived') return 1;
  if (!(session.totalM > 0)) return 0;
  return Math.min(1, Math.max(0, session.alongM / session.totalM));
}

export type HapticCue = 'turn' | 'arrive' | 'confirm';

/** Vibration patterns (ms on / off / on). Short, so they're felt rather than noticed. */
export const HAPTIC_PATTERNS: Record<HapticCue, number[]> = { turn: [70], arrive: [90, 110, 90], confirm: [25] };

/** A buzz for the 200 m warning and for arrival; every other prompt is voice only. */
export function hapticFor(a: Pick<Announcement, 'key'>): HapticCue | null {
  if (a.key.endsWith(':200')) return 'turn';
  if (a.key.endsWith(':arrived')) return 'arrive';
  return null;
}

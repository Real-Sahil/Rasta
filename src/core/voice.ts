/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Language } from '../types';
import { PhraseKey, SPOKEN_DISTANCES_M, SpokenDistance, VoiceLang } from './phrases';

/** Which voice language the app speaks for a UI language. Arabic UI has no Arabic directions, so it speaks English. */
export const toVoiceLang = (ui: Language): VoiceLang => (ui === 'ur' ? 'ur' : ui === 'pa' ? 'pa' : 'en');

export interface VoiceInfo {
  lang: string;
  name: string;
  default?: boolean;
}

export type VoiceStatus =
  | 'ok' // a matching voice exists
  | 'approximate' // Punjabi read by an Urdu voice (similar script and sounds, pronunciation is close but not exact)
  | 'none'; // no usable voice: show text only and say so

export interface VoiceSupport {
  status: VoiceStatus;
  voice: VoiceInfo | null;
  /** BCP-47 tag to put on the utterance */
  langTag: string;
}

const norm = (l: string) => l.replace('_', '-').toLowerCase();
const startsWith = (v: VoiceInfo, prefix: string) => norm(v.lang) === prefix || norm(v.lang).startsWith(prefix + '-');
const prefer = (voices: VoiceInfo[], order: string[]) => {
  for (const tag of order) {
    const hit = voices.find((v) => norm(v.lang) === tag);
    if (hit) return hit;
  }
  return null;
};

/**
 * Pick the best installed voice for a language. Pure, so it is tested without a browser.
 * Punjabi note: Pakistani Punjabi is written in Shahmukhi (Arabic script). Gurmukhi (pa-IN) voices cannot read it,
 * so they are ignored; an Urdu voice reads Shahmukhi acceptably and is reported as 'approximate'.
 */
export function chooseVoice(lang: VoiceLang, voices: VoiceInfo[]): VoiceSupport {
  if (lang === 'en') {
    const v = prefer(voices, ['en-gb', 'en-pk', 'en-in', 'en-us']) ?? voices.find((x) => startsWith(x, 'en')) ?? null;
    return v ? { status: 'ok', voice: v, langTag: v.lang } : { status: 'none', voice: null, langTag: 'en-US' };
  }
  if (lang === 'ur') {
    const v = prefer(voices, ['ur-pk']) ?? voices.find((x) => startsWith(x, 'ur')) ?? null;
    return v ? { status: 'ok', voice: v, langTag: v.lang } : { status: 'none', voice: null, langTag: 'ur-PK' };
  }
  const arab = voices.find((x) => ['pa-pk', 'pa-arab', 'pa-arab-pk'].includes(norm(x.lang)));
  if (arab) return { status: 'ok', voice: arab, langTag: arab.lang };
  const ur = prefer(voices, ['ur-pk']) ?? voices.find((x) => startsWith(x, 'ur')) ?? null;
  return ur ? { status: 'approximate', voice: ur, langTag: ur.lang } : { status: 'none', voice: null, langTag: 'ur-PK' };
}

// ---------------------------------------------------------------- recorded clips
/** `public/audio/manifest.json`: which clip keys exist per language, e.g. { "ur": ["d500","d200","turn-left", ...] }. */
export type ClipManifest = Partial<Record<VoiceLang, string[]>>;

export const clipUrl = (lang: VoiceLang, key: string) => `/audio/${lang}/${key}.mp3`;
export const distanceClipKey = (m: SpokenDistance) => `d${m}`;

/** Clips to play, in order, for a phrase. Returns null unless EVERY needed clip is recorded (never mix voices mid-sentence). */
export function planClips(lang: VoiceLang, phrase: PhraseKey, distanceM: SpokenDistance | null, manifest: ClipManifest | null): string[] | null {
  const have = new Set(manifest?.[lang] ?? []);
  const keys = [...(distanceM ? [distanceClipKey(distanceM)] : []), phrase];
  return keys.every((k) => have.has(k)) ? keys : null;
}

/** Every clip key a full recording set needs (for docs and for the recorder checklist). */
export const ALL_CLIP_KEYS = (phrases: PhraseKey[]): string[] => [...SPOKEN_DISTANCES_M.map(distanceClipKey), ...phrases];

import { describe, it, expect } from 'vitest';
import { PHRASES, PHRASE_KEYS, renderPhrase, phraseForManeuver } from './phrases';
import { chooseVoice, planClips, toVoiceLang, ALL_CLIP_KEYS, clipUrl } from './voice';

const v = (lang: string, name = lang) => ({ lang, name });
const ARABIC_SCRIPT = /[؀-ۿ]/;

describe('phrase catalogue', () => {
  it('has English, Urdu and Punjabi text for every phrase', () => {
    for (const k of PHRASE_KEYS) for (const l of ['en', 'ur', 'pa'] as const) expect(PHRASES[k][l].trim().length).toBeGreaterThan(2);
  });
  it('Urdu and Punjabi are Arabic-script only (no stray Latin words a voice would mispronounce)', () => {
    for (const k of PHRASE_KEYS) for (const l of ['ur', 'pa'] as const) {
      expect(PHRASES[k][l]).toMatch(ARABIC_SCRIPT);
      expect(PHRASES[k][l]).not.toMatch(/[A-Za-z]/);
    }
  });
  it('Punjabi is genuinely different from Urdu where the languages differ (left/right/straight)', () => {
    for (const k of ['turn-left', 'turn-right', 'straight'] as const) expect(PHRASES[k].pa).not.toBe(PHRASES[k].ur);
  });
  it('renders distance prefixes per language', () => {
    expect(renderPhrase('turn-left', 'en', 500)).toBe('In 500 meters, Turn left');
    expect(renderPhrase('turn-left', 'ur', 200)).toBe('200 میٹر بعد، بائیں مڑیں');
    expect(renderPhrase('turn-left', 'pa')).toBe('کھبے مڑو');
  });
  it('maps route manoeuvres to phrases with a safe default', () => {
    expect(phraseForManeuver('turn-right')).toBe('turn-right');
    expect(phraseForManeuver('something-new')).toBe('straight');
  });
});

describe('chooseVoice', () => {
  it('English prefers en-GB/PK/IN/US and reports none when absent', () => {
    expect(chooseVoice('en', [v('en-US'), v('en-GB')]).voice?.lang).toBe('en-GB');
    expect(chooseVoice('en', [v('fr-FR')]).status).toBe('none');
  });
  it('Urdu prefers ur-PK, accepts other ur-*, otherwise none', () => {
    expect(chooseVoice('ur', [v('ur-IN'), v('ur-PK')]).voice?.lang).toBe('ur-PK');
    expect(chooseVoice('ur', [v('ur_IN')]).status).toBe('ok');
    expect(chooseVoice('ur', [v('en-GB'), v('hi-IN')])).toMatchObject({ status: 'none', langTag: 'ur-PK' });
  });
  it('Punjabi: a Shahmukhi voice is ok; Gurmukhi pa-IN is ignored; falls back to an Urdu voice as approximate', () => {
    expect(chooseVoice('pa', [v('pa-PK')]).status).toBe('ok');
    expect(chooseVoice('pa', [v('pa-IN')]).status).toBe('none');
    expect(chooseVoice('pa', [v('pa-IN'), v('ur-PK')])).toMatchObject({ status: 'approximate', langTag: 'ur-PK' });
  });
  it('Arabic UI speaks English directions', () => {
    expect(toVoiceLang('ar')).toBe('en');
    expect(toVoiceLang('pa')).toBe('pa');
  });
});

describe('recorded clips', () => {
  const manifest = { ur: ['d500', 'd200', 'turn-left'], pa: ['turn-left'] };
  it('plans distance + phrase clips only when every clip exists', () => {
    expect(planClips('ur', 'turn-left', 500, manifest)).toEqual(['d500', 'turn-left']);
    expect(planClips('ur', 'turn-left', null, manifest)).toEqual(['turn-left']);
    expect(planClips('ur', 'turn-right', null, manifest)).toBeNull();
    expect(planClips('pa', 'turn-left', 200, manifest)).toBeNull(); // missing d200: never mix recording and TTS mid-sentence
    expect(planClips('en', 'turn-left', null, manifest)).toBeNull();
    expect(planClips('ur', 'turn-left', null, null)).toBeNull();
  });
  it('lists every clip a full recording set needs', () => {
    expect(ALL_CLIP_KEYS(PHRASE_KEYS)).toEqual(['d500', 'd200', ...PHRASE_KEYS]);
    expect(clipUrl('pa', 'turn-left')).toBe('/audio/pa/turn-left.mp3');
  });
});

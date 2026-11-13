import { describe, it, expect, vi } from 'vitest';
// @ts-ignore plain JS module
import { clipJobs, countChars, PROVIDERS, missingEnv, updateManifest } from './voice-gen.mjs';
import { PHRASE_KEYS } from '../../src/core/phrases';

describe('clipJobs', () => {
  it('produces every clip for every language, matching the recording checklist (13 per language)', () => {
    const jobs = clipJobs();
    expect(jobs).toHaveLength(13 * 3);
    for (const lang of ['en', 'ur', 'pa']) {
      const keys = jobs.filter((j: any) => j.lang === lang).map((j: any) => j.key);
      expect(keys).toEqual(['d500', 'd200', ...PHRASE_KEYS]);
    }
  });
  it('distance clips contain only the prefix, not the phrase', () => {
    expect(clipJobs(['ur']).find((j: any) => j.key === 'd500')?.text).toBe('500 میٹر بعد،');
    expect(clipJobs(['en']).find((j: any) => j.key === 'd200')?.text).toBe('In 200 meters,');
  });
  it('is small enough to be nearly free (a few thousand characters in total)', () => {
    expect(countChars(clipJobs())).toBeLessThan(2000);
  });
});

describe('provider request builders', () => {
  const env = { AZURE_SPEECH_KEY: 'k', AZURE_SPEECH_REGION: 'southeastasia', GOOGLE_TTS_API_KEY: 'g k', ELEVENLABS_API_KEY: 'e', ELEVENLABS_VOICE_UR: 'vurdu', ELEVENLABS_VOICE_EN: 'ven', ELEVENLABS_VOICE_PA: 'vpa' };
  it('azure: regional endpoint, key header, SSML with a Pakistani Urdu voice (also for Punjabi), XML-escaped', () => {
    const r = PROVIDERS.azure.request({ text: 'a < b & "c"', lang: 'ur', env });
    expect(r.url).toBe('https://southeastasia.tts.speech.microsoft.com/cognitiveservices/v1');
    expect(r.init.headers['Ocp-Apim-Subscription-Key']).toBe('k');
    expect(r.init.body).toContain("xml:lang='ur-PK'");
    expect(r.init.body).toContain('ur-PK-UzmaNeural');
    expect(r.init.body).toContain('a &lt; b &amp; &quot;c&quot;');
    expect(PROVIDERS.azure.request({ text: 'x', lang: 'pa', env }).init.body).toContain('ur-PK-UzmaNeural');
    expect(PROVIDERS.azure.request({ text: 'x', lang: 'en', env }).init.body).toContain('en-GB');
  });
  it('elevenlabs: per-language voice id and key header', () => {
    const r = PROVIDERS.elevenlabs.request({ text: 'سلام', lang: 'ur', env });
    expect(r.url).toContain('/v1/text-to-speech/vurdu');
    expect(r.init.headers['xi-api-key']).toBe('e');
    expect(JSON.parse(r.init.body)).toMatchObject({ text: 'سلام', model_id: 'eleven_multilingual_v2' });
  });
  it('google: URL-encodes the key, uses ur-IN, and refuses Shahmukhi Punjabi', async () => {
    const r = PROVIDERS.google.request({ text: 'x', lang: 'ur', env });
    expect(r.url).toContain('key=g%20k');
    expect(JSON.parse(r.init.body).voice.languageCode).toBe('ur-IN');
    expect(() => PROVIDERS.google.request({ text: 'x', lang: 'pa', env })).toThrow(/Shahmukhi/);
    const audio = await r.decode({ json: async () => ({ audioContent: Buffer.from('hello').toString('base64') }) });
    expect(audio.toString()).toBe('hello');
  });
  it('reports missing credentials per provider', () => {
    expect(missingEnv('azure', {})).toEqual(['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION']);
    expect(missingEnv('azure', env)).toEqual([]);
  });
});

describe('updateManifest', () => {
  it('merges, de-duplicates and sorts without touching other languages', () => {
    const m = updateManifest({ ur: ['turn-left'], en: ['d500'] }, 'ur', ['d500', 'turn-left', 'arrive']);
    expect(m).toEqual({ ur: ['arrive', 'd500', 'turn-left'], en: ['d500'] });
  });
});

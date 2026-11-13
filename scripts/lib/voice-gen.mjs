// Pure helpers for generating the spoken-direction clips with a cloud text-to-speech service.
// Request builders take no network access, so they are unit-tested; scripts/generate-voice.mjs does the I/O.
import { PHRASES, PHRASE_KEYS, SPOKEN_DISTANCES_M, renderPhrase } from '../../src/core/phrases.ts';

export const LANGS = ['en', 'ur', 'pa'];

/** Every clip to generate: { lang, key, text }. Distance clips contain just the prefix ("In 500 meters,"). */
export function clipJobs(langs = LANGS) {
  const jobs = [];
  for (const lang of langs) {
    for (const m of SPOKEN_DISTANCES_M) {
      const withPhrase = renderPhrase('straight', lang, m);
      jobs.push({ lang, key: `d${m}`, text: withPhrase.slice(0, withPhrase.length - PHRASES.straight[lang].length).trim() });
    }
    for (const key of PHRASE_KEYS) jobs.push({ lang, key, text: PHRASES[key][lang] });
  }
  return jobs;
}

export const countChars = (jobs) => jobs.reduce((n, j) => n + j.text.length, 0);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------- providers
// Each returns { url, init, decode(res) -> Buffer }.
export const PROVIDERS = {
  /**
   * Azure AI Speech. Pakistani Urdu has native neural voices (ur-PK). There is no Shahmukhi Punjabi voice:
   * Punjabi text is read by the Urdu voice, which is why Punjabi stays flagged "approximate" in the app.
   */
  azure: {
    voices: { en: ['en-GB', 'en-GB-SoniaNeural'], ur: ['ur-PK', 'ur-PK-UzmaNeural'], pa: ['ur-PK', 'ur-PK-UzmaNeural'] },
    request({ text, lang, env }) {
      const [locale, voice] = this.voices[lang];
      return {
        url: `https://${env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
        init: {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
            'User-Agent': 'buraq-pakistan-voice-build'
          },
          body: `<speak version='1.0' xml:lang='${locale}'><voice name='${voice}'><prosody rate='-5%'>${esc(text)}</prosody></voice></speak>`
        },
        decode: async (res) => Buffer.from(await res.arrayBuffer())
      };
    },
    requiredEnv: ['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION']
  },

  /** ElevenLabs. Pick a voice per language (ELEVENLABS_VOICE_EN / _UR / _PA). Multilingual models cover Urdu; check Punjabi quality by ear. */
  elevenlabs: {
    request({ text, lang, env }) {
      const voice = env[`ELEVENLABS_VOICE_${lang.toUpperCase()}`];
      return {
        url: `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`,
        init: {
          method: 'POST',
          headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
          body: JSON.stringify({ text, model_id: env.ELEVENLABS_MODEL || 'eleven_multilingual_v2', voice_settings: { stability: 0.6, similarity_boost: 0.75 } })
        },
        decode: async (res) => Buffer.from(await res.arrayBuffer())
      };
    },
    requiredEnv: ['ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_EN', 'ELEVENLABS_VOICE_UR', 'ELEVENLABS_VOICE_PA']
  },

  /** Google Cloud Text-to-Speech. Urdu is ur-IN (no ur-PK); Punjabi voices are Gurmukhi (pa-IN) and cannot read Shahmukhi, so pa is refused. */
  google: {
    voices: { en: 'en-GB', ur: 'ur-IN' },
    request({ text, lang, env }) {
      if (lang === 'pa') throw new Error('Google TTS has no Shahmukhi Punjabi voice (pa-IN is Gurmukhi script). Use another provider or a recording for pa.');
      return {
        url: `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(env.GOOGLE_TTS_API_KEY)}`,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: { text }, voice: { languageCode: this.voices[lang] }, audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95 } })
        },
        decode: async (res) => Buffer.from((await res.json()).audioContent, 'base64')
      };
    },
    requiredEnv: ['GOOGLE_TTS_API_KEY']
  }
};

export function missingEnv(provider, env) {
  return PROVIDERS[provider].requiredEnv.filter((k) => !env[k]);
}

/** Merge newly generated keys into the manifest, keeping existing ones, sorted. */
export function updateManifest(manifest, lang, keys) {
  const set = new Set([...(manifest[lang] ?? []), ...keys]);
  return { ...manifest, [lang]: [...set].sort() };
}

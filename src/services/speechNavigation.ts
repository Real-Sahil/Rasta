/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Language } from '../types';
import { Announcement, textFor } from '../core/announcer';
import { ClipManifest, VoiceInfo, VoiceSupport, chooseVoice, clipUrl, planClips, toVoiceLang } from '../core/voice';
import { VoiceLang } from '../core/phrases';
import { NativeTts, isNative } from './native';

/**
 * Spoken directions in English, Urdu and Punjabi.
 *  1. If every clip for the phrase is recorded (public/audio/manifest.json), play the recordings: identical on every phone, works offline.
 *  2. Otherwise use the phone's text-to-speech voice for that language (see chooseVoice for the Urdu/Punjabi rules).
 *  3. If neither exists, stay silent and report `status: 'none'` so the UI can say so instead of failing quietly.
 * Duplicate prompts within 12 s are suppressed unless forced (the "repeat" button forces).
 */
export class SpeechNavigationService {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  /** Android app: languages the phone's own TTS engine offers (the WebView often lists none). */
  private nativeVoices: VoiceInfo[] = [];
  private uiLang: Language = 'en';
  private muted = false;
  private manifest: ClipManifest | null = null;
  private manifestRequested = false;
  private current: HTMLAudioElement | null = null;
  private lastKey = '';
  private lastAt = 0;
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) this.synth.onvoiceschanged = () => this.loadVoices();
    }
    if (isNative()) {
      NativeTts.getSupportedLanguages()
        .then((r) => {
          this.nativeVoices = (r.languages ?? []).map((l) => ({ lang: l, name: l }));
          this.listeners.forEach((l) => l());
        })
        .catch(() => { /* no native engine: the WebView voices (if any) are used */ });
    }
  }

  private voiceInfos(): VoiceInfo[] {
    if (isNative() && this.nativeVoices.length) return this.nativeVoices;
    return this.voices.map((x) => ({ lang: x.lang, name: x.name, default: x.default }));
  }

  private loadVoices() {
    try {
      this.voices = this.synth?.getVoices() ?? [];
    } catch (e) {
      console.warn('TTS: could not read voices', e);
    }
    this.listeners.forEach((l) => l());
  }

  /** Recorded clips are optional: a missing manifest just means "use text-to-speech". */
  private async ensureManifest() {
    if (this.manifestRequested || typeof fetch === 'undefined') return;
    this.manifestRequested = true;
    try {
      const res = await fetch('/audio/manifest.json', { cache: 'no-cache' });
      if (res.ok && (res.headers.get('content-type') ?? '').includes('json')) {
        this.manifest = await res.json();
        this.listeners.forEach((l) => l());
      }
    } catch {
      /* no recordings available */
    }
  }

  setPreferences(lang: Language, muted: boolean) {
    this.uiLang = lang;
    this.muted = muted;
    void this.ensureManifest();
    this.listeners.forEach((l) => l());
  }

  /** What the current language will sound like on this device: ok / approximate (Punjabi via Urdu voice) / none. */
  getSupport(lang: Language = this.uiLang): VoiceSupport & { hasRecordings: boolean } {
    const v = toVoiceLang(lang);
    const tts = chooseVoice(v, this.voiceInfos());
    const hasRecordings = (this.manifest?.[v]?.length ?? 0) > 0;
    // Recordings cover the whole vocabulary or nothing (planClips), so they upgrade the status only when complete.
    return { ...tts, hasRecordings };
  }

  /** Subscribe to voice/recording availability changes (voices load asynchronously). Returns unsubscribe. */
  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  speakAnnouncement(a: Announcement, force = false): void {
    if (this.muted) return;
    const lang = toVoiceLang(this.uiLang);
    const now = Date.now();
    if (!force && a.key === this.lastKey && now - this.lastAt < 12_000) return;
    this.lastKey = a.key;
    this.lastAt = now;
    this.stop(false);

    // In the Android app the WebView pauses audio elements when the screen locks, so the phone's native TTS is used instead.
    const clips = isNative() ? null : planClips(lang, a.phrase, a.distanceM, this.manifest);
    if (clips && typeof Audio !== 'undefined') {
      this.playClips(lang, clips, () => this.speakText(a, lang));
      return;
    }
    this.speakText(a, lang);
  }

  private playClips(lang: VoiceLang, keys: string[], onFail: () => void) {
    let i = 0;
    const next = () => {
      if (i >= keys.length) return;
      const el = new Audio(clipUrl(lang, keys[i++]));
      this.current = el;
      el.onended = next;
      el.onerror = () => {
        this.stop(false);
        onFail(); // a clip failed to load: fall back to text-to-speech for the whole sentence
      };
      el.play().catch(() => onFail());
    };
    next();
  }

  private speakText(a: Announcement, lang: VoiceLang) {
    const native = isNative() && this.nativeVoices.length > 0;
    if (!native && !this.synth) return;
    const support = chooseVoice(lang, this.voiceInfos());
    if (support.status === 'none') return; // the UI shows "no voice on this device"; nothing to say it with
    if (native) {
      NativeTts.speak({ text: textFor(a, lang), lang: support.langTag, rate: 0.9, pitch: 1, volume: 1, queueStrategy: 1 /* flush: newest prompt replaces an older one */ })
        .catch((err) => console.warn('Native TTS failed', err));
      return;
    }
    try {
      const u = new SpeechSynthesisUtterance(textFor(a, lang));
      const voice = this.voices.find((v) => v.name === support.voice?.name && v.lang === support.voice?.lang);
      if (voice) u.voice = voice;
      u.lang = support.langTag;
      u.rate = 0.9; // measured driving pace
      u.pitch = 1;
      u.volume = 1;
      u.onerror = (e) => console.warn('TTS utterance error', e);
      this.synth?.speak(u);
    } catch (err) {
      console.warn('TTS failed', err);
    }
  }

  stop(resetDedupe = true) {
    if (this.current) {
      this.current.onended = null;
      this.current.onerror = null;
      try { this.current.pause(); } catch { /* ignore */ }
      this.current = null;
    }
    try { this.synth?.cancel(); } catch { /* ignore */ }
    if (isNative()) void NativeTts.stop().catch(() => {});
    if (resetDedupe) {
      this.lastKey = '';
      this.lastAt = 0;
    }
  }
}

export const speechNavigator = new SpeechNavigationService();

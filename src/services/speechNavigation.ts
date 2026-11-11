/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Language } from '../types';

class SpeechNavigationService {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private currentLang: Language = 'en';
  private isMuted = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.initVoices();
      }
    }
  }

  private initVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
  }

  public setPreferences(lang: Language, muted: boolean) {
    this.currentLang = lang;
    this.isMuted = muted;
  }

  public speak(instructionEn: string, instructionUrdu: string, instructionPunjabi?: string, instructionArabic?: string) {
    if (this.isMuted || !this.synth) return;

    this.synth.cancel(); // Stop pending speech

    let textToSpeak = instructionEn;
    let langCode = 'en-US';

    if (this.currentLang === 'ur') {
      textToSpeak = instructionUrdu || instructionEn;
      langCode = 'ur-PK';
    } else if (this.currentLang === 'pa') {
      textToSpeak = instructionPunjabi || instructionUrdu || instructionEn;
      langCode = 'pa-PK';
    } else if (this.currentLang === 'ar') {
      textToSpeak = instructionArabic || instructionEn;
      langCode = 'ar-SA';
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    // Find voice matching current language or region
    const matchedVoice = this.voices.find(v => v.lang.startsWith(this.currentLang) || v.lang.includes(langCode));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.lang = langCode;
    utterance.rate = 0.92;
    utterance.pitch = 1.0;

    this.synth.speak(utterance);
  }

  public stop() {
    if (this.synth) {
      this.synth.cancel();
    }
  }
}

export const speechNavigator = new SpeechNavigationService();

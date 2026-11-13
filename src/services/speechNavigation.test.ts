import { describe, it, expect } from 'vitest';
import { speechNavigator } from './speechNavigation';

describe('speechNavigator (no speechSynthesis available)', () => {
  it('initialises and reports a voice summary', () => {
    const s = speechNavigator.getSupportedVoicesSummary();
    expect(typeof s.totalVoices).toBe('number');
  });
  it('speak / stop never throw without speechSynthesis', () => {
    speechNavigator.setPreferences('ur', false);
    expect(() => speechNavigator.speak('Turn right', 'دائیں مڑیں')).not.toThrow();
    expect(() => speechNavigator.stop()).not.toThrow();
  });
});

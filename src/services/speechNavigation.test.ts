import { describe, it, expect, vi, afterEach } from 'vitest';
import { speechNavigator } from './speechNavigation';
import { simpleAnnouncement } from '../core/announcer';

describe('speechNavigator without any audio support (e.g. a bare test runtime)', () => {
  it('reports no voice instead of throwing, and speak/stop never throw', () => {
    speechNavigator.setPreferences('ur', false);
    expect(speechNavigator.getSupport('ur').status).toBe('none');
    expect(speechNavigator.getSupport('pa').status).toBe('none');
    expect(() => speechNavigator.speakAnnouncement(simpleAnnouncement('k', 'turn-left'))).not.toThrow();
    expect(() => speechNavigator.stop()).not.toThrow();
  });
  it('notifies subscribers when preferences change and stops notifying after unsubscribe', () => {
    const cb = vi.fn();
    const off = speechNavigator.subscribe(cb);
    speechNavigator.setPreferences('en', false);
    expect(cb).toHaveBeenCalled();
    off();
    cb.mockClear();
    speechNavigator.setPreferences('ur', false);
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('speaking through text-to-speech', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the Urdu voice and Urdu text, and Punjabi text via an Urdu voice', async () => {
    const spoken: { text: string; lang: string }[] = [];
    class Utt { text: string; lang = ''; voice: unknown; rate = 1; pitch = 1; volume = 1; onerror: unknown; constructor(t: string) { this.text = t; } }
    const synth = {
      getVoices: () => [{ lang: 'ur-PK', name: 'Urdu Voice', default: false }, { lang: 'en-GB', name: 'English', default: true }],
      speak: (u: Utt) => spoken.push({ text: u.text, lang: u.lang }),
      cancel: () => {}, onvoiceschanged: null
    };
    vi.stubGlobal('window', { speechSynthesis: synth });
    vi.stubGlobal('SpeechSynthesisUtterance', Utt);
    vi.resetModules();
    const { SpeechNavigationService } = await import('./speechNavigation');
    const svc = new SpeechNavigationService();
    const a = simpleAnnouncement('x', 'turn-right');

    svc.setPreferences('ur', false);
    svc.speakAnnouncement(a, true);
    svc.setPreferences('pa', false);
    expect(svc.getSupport('pa').status).toBe('approximate');
    svc.speakAnnouncement(a, true);
    svc.setPreferences('en', false);
    svc.speakAnnouncement(a, true);

    expect(spoken).toEqual([
      { text: 'دائیں مڑیں', lang: 'ur-PK' },
      { text: 'سجے مڑو', lang: 'ur-PK' },
      { text: 'Turn right', lang: 'en-GB' }
    ]);
  });

  it('is silent when muted and when the same prompt repeats within 12 s unless forced', async () => {
    const spoken: string[] = [];
    class Utt { text: string; constructor(t: string) { this.text = t; } }
    vi.stubGlobal('window', { speechSynthesis: { getVoices: () => [{ lang: 'en-GB', name: 'E', default: true }], speak: (u: Utt) => spoken.push(u.text), cancel: () => {} } });
    vi.stubGlobal('SpeechSynthesisUtterance', Utt);
    vi.resetModules();
    const { SpeechNavigationService } = await import('./speechNavigation');
    const svc = new SpeechNavigationService();
    const a = simpleAnnouncement('same', 'straight');
    svc.setPreferences('en', true);
    svc.speakAnnouncement(a);
    expect(spoken).toHaveLength(0);
    svc.setPreferences('en', false);
    svc.speakAnnouncement(a);
    svc.speakAnnouncement(a);
    expect(spoken).toHaveLength(1);
    svc.speakAnnouncement(a, true);
    expect(spoken).toHaveLength(2);
  });
});

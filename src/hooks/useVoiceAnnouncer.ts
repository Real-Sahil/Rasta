/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState } from 'react';
import { useAppStore } from '../core/store';
import { speechNavigator } from '../services/speechNavigation';
import { Language } from '../types';

/**
 * Speaks store announcements in the UI language (en / ur / pa), honouring mute, on any tab.
 * Returns what the voice will sound like on this device so the UI can say so ('none' = no voice, text only).
 */
export function useVoiceAnnouncer(language: Language) {
  const announcement = useAppStore((s) => s.announcement);
  const muted = useAppStore((s) => s.voiceMuted);
  const inTrip = useAppStore((s) => s.session !== null);
  const [support, setSupport] = useState(() => speechNavigator.getSupport(language));

  useEffect(() => {
    speechNavigator.setPreferences(language, muted);
    if (muted) speechNavigator.stop();
    const refresh = () => setSupport(speechNavigator.getSupport(language));
    refresh();
    return speechNavigator.subscribe(refresh); // voices and recordings arrive asynchronously
  }, [language, muted]);

  useEffect(() => {
    if (!announcement || muted) return;
    speechNavigator.speakAnnouncement(announcement, true);
  }, [announcement?.seq]);

  useEffect(() => {
    if (!inTrip) speechNavigator.stop();
  }, [inTrip]);

  return support;
}

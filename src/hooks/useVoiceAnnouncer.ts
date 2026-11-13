/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect } from 'react';
import { useAppStore } from '../core/store';
import { speechNavigator } from '../services/speechNavigation';
import { Language } from '../types';

/** Speaks store announcements, honouring the store's mute flag and the UI language (works on any tab). */
export function useVoiceAnnouncer(language: Language) {
  const announcement = useAppStore((s) => s.announcement);
  const muted = useAppStore((s) => s.voiceMuted);
  const inTrip = useAppStore((s) => s.session !== null);

  useEffect(() => {
    speechNavigator.setPreferences(language, muted);
    if (muted) speechNavigator.stop();
  }, [language, muted]);

  useEffect(() => {
    if (!announcement || muted) return;
    speechNavigator.speak(announcement.en, announcement.ur, announcement.ur, undefined, true);
  }, [announcement?.seq]);

  useEffect(() => {
    if (!inTrip) speechNavigator.stop();
  }, [inTrip]);
}

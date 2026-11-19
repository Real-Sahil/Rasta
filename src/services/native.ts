/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * The Android app (Capacitor shell) loads this same web app. Inside it two native plugins make navigation work
 * with the screen locked: a foreground-service GPS watcher and the phone's text-to-speech engine.
 * In a normal browser none of this exists and `isNative()` is false, so the web app is unchanged.
 */
export const isNative = (): boolean => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

export interface NativeLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  speed: number | null;
  /** degrees clockwise from north, or null when unknown */
  bearing: number | null;
  /** epoch ms */
  time: number | null;
}

export interface BackgroundGeolocationPlugin {
  addWatcher(
    options: { backgroundMessage?: string; backgroundTitle?: string; requestPermissions?: boolean; stale?: boolean; distanceFilter?: number },
    callback: (location?: NativeLocation, error?: { code?: string; message?: string }) => void
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
  openSettings(): Promise<void>;
}

export interface TextToSpeechPlugin {
  speak(options: { text: string; lang?: string; rate?: number; pitch?: number; volume?: number; category?: string; queueStrategy?: number }): Promise<void>;
  stop(): Promise<void>;
  getSupportedLanguages(): Promise<{ languages: string[] }>;
}

export const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
export const NativeTts = registerPlugin<TextToSpeechPlugin>('TextToSpeech');

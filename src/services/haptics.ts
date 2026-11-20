/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { HAPTIC_PATTERNS, HapticCue } from '../core/hud';

/**
 * Short vibration for driving cues. Uses the Vibration API, which Android browsers and the Android app's WebView
 * support; iPhone browsers don't, so there it does nothing. Works while the voice is muted, which is when it helps most.
 */
export function buzz(cue: HapticCue): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(HAPTIC_PATTERNS[cue]);
  } catch {
    /* not available: nothing to do */
  }
}

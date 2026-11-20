import 'package:flutter/services.dart';

import '../core/hud.dart';

/// Short haptic cues while driving. Uses the phone's own haptics (no permission); a phone with touch
/// vibration switched off in its settings stays silent, which is the user's choice.
Future<void> buzz(HapticCue cue) async {
  try {
    switch (cue) {
      case HapticCue.turn:
        await HapticFeedback.heavyImpact();
      case HapticCue.arrive:
        await HapticFeedback.heavyImpact();
        await Future<void>.delayed(const Duration(milliseconds: 180));
        await HapticFeedback.heavyImpact();
      case HapticCue.confirm:
        await HapticFeedback.lightImpact();
    }
  } catch (_) {
    // not available: nothing to do
  }
}

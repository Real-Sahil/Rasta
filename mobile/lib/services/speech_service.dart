import 'package:flutter_tts/flutter_tts.dart';

import '../core/announcer.dart';
import '../core/phrases.dart';
import '../core/voice.dart';

/// Spoken directions through the phone's own text-to-speech engine. Works with the screen locked.
/// Duplicate prompts within 12 s are suppressed unless forced. No voice for a language means silence plus a
/// visible notice (see [support]); nothing is spoken in the wrong language.
class SpeechService {
  late final FlutterTts _tts = FlutterTts(); // lazy: tests use a fake and never touch the platform channel
  List<VoiceInfo> _voices = [];
  String _lastKey = '';
  DateTime _lastAt = DateTime.fromMillisecondsSinceEpoch(0);
  bool muted = false;

  Future<void> init() async {
    try {
      final langs = await _tts.getLanguages;
      if (langs is List) _voices = langs.map((l) => VoiceInfo(l.toString())).toList();
      await _tts.setSpeechRate(0.45); // driving pace on Android's 0..1 scale
      await _tts.setVolume(1);
      await _tts.setPitch(1);
      await _tts.awaitSpeakCompletion(false);
    } catch (_) {
      // no TTS engine: support() reports none
    }
  }

  VoiceSupport support(VoiceLang lang) => chooseVoice(lang, _voices);

  Future<void> speak(Announcement a, VoiceLang lang, {bool force = false, DateTime? now}) async {
    if (muted) return;
    final t = now ?? DateTime.now();
    if (!force && a.key == _lastKey && t.difference(_lastAt).inSeconds < 12) return;
    _lastKey = a.key;
    _lastAt = t;
    final s = support(lang);
    if (s.status == VoiceStatus.none) return;
    try {
      await _tts.stop();
      await _tts.setLanguage(s.langTag);
      await _tts.speak(a.textFor(lang));
    } catch (_) {
      // a failing engine must never break navigation
    }
  }

  Future<void> stop() async {
    try {
      await _tts.stop();
    } catch (_) {}
  }
}

import 'phrases.dart';

/// Which voice language the app speaks for a UI language code. Arabic UI has no Arabic directions: speaks English.
VoiceLang toVoiceLang(String ui) => ui == 'ur' ? VoiceLang.ur : (ui == 'pa' ? VoiceLang.pa : VoiceLang.en);

class VoiceInfo {
  const VoiceInfo(this.lang, [this.name = '']);
  final String lang;
  final String name;
}

enum VoiceStatus { ok, approximate, none }

class VoiceSupport {
  const VoiceSupport(this.status, this.voice, this.langTag);
  final VoiceStatus status;
  final VoiceInfo? voice;
  final String langTag;
}

String _norm(String l) => l.replaceAll('_', '-').toLowerCase();
bool _startsWith(VoiceInfo v, String prefix) => _norm(v.lang) == prefix || _norm(v.lang).startsWith('$prefix-');

VoiceInfo? _prefer(List<VoiceInfo> voices, List<String> order) {
  for (final tag in order) {
    for (final v in voices) {
      if (_norm(v.lang) == tag) return v;
    }
  }
  return null;
}

VoiceInfo? _firstWhere(List<VoiceInfo> voices, bool Function(VoiceInfo) test) {
  for (final v in voices) {
    if (test(v)) return v;
  }
  return null;
}

/// Pick the best installed voice for a language.
/// Pakistani Punjabi is written in Shahmukhi (Arabic script). Gurmukhi (pa-IN) voices cannot read it, so they are
/// ignored; an Urdu voice reads Shahmukhi acceptably and is reported as approximate.
VoiceSupport chooseVoice(VoiceLang lang, List<VoiceInfo> voices) {
  if (lang == VoiceLang.en) {
    final v = _prefer(voices, ['en-gb', 'en-pk', 'en-in', 'en-us']) ?? _firstWhere(voices, (x) => _startsWith(x, 'en'));
    return v != null ? VoiceSupport(VoiceStatus.ok, v, v.lang) : const VoiceSupport(VoiceStatus.none, null, 'en-US');
  }
  if (lang == VoiceLang.ur) {
    final v = _prefer(voices, ['ur-pk']) ?? _firstWhere(voices, (x) => _startsWith(x, 'ur'));
    return v != null ? VoiceSupport(VoiceStatus.ok, v, v.lang) : const VoiceSupport(VoiceStatus.none, null, 'ur-PK');
  }
  final arab = _firstWhere(voices, (x) => const ['pa-pk', 'pa-arab', 'pa-arab-pk'].contains(_norm(x.lang)));
  if (arab != null) return VoiceSupport(VoiceStatus.ok, arab, arab.lang);
  final ur = _prefer(voices, ['ur-pk']) ?? _firstWhere(voices, (x) => _startsWith(x, 'ur'));
  return ur != null ? VoiceSupport(VoiceStatus.approximate, ur, ur.lang) : const VoiceSupport(VoiceStatus.none, null, 'ur-PK');
}

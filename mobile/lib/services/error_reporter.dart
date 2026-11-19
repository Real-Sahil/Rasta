// First-party error reporting, the Flutter twin of src/services/errorReporting.ts. Errors go to our own
// /api?op=log (Postgres, read in /admin.html, 14-day retention). Never: user identifiers, coordinates, search words.
import 'dart:convert';
import 'dart:io' show Platform;

import 'package:http/http.dart' as http;

import 'api_client.dart' show apiBase;

const appRelease = String.fromEnvironment('APP_VERSION', defaultValue: '1.0.0+1');

typedef PostFn = Future<void> Function(Uri url, String body);

Future<void> _defaultPost(Uri url, String body) async {
  await http.post(url, headers: {'content-type': 'application/json'}, body: body).timeout(const Duration(seconds: 10));
}

/// Numbers with 3+ decimals (coordinates, precise distances) and long digit runs are replaced, so a message that
/// happens to contain a position or an id can't leak it.
String scrub(String s) => s
    .replaceAll(RegExp(r'-?\d{1,3}\.\d{3,}'), '<n>')
    .replaceAll(RegExp(r'\d{7,}'), '<n>')
    .replaceAll(RegExp(r'[?&](q|lat|lon|lng|viewbox|coordinates)=[^&\s]*'), '?<query>');

class ErrorReporter {
  ErrorReporter({PostFn? post, String? platform, this.base = apiBase, this.enabled = true})
      : _post = post ?? _defaultPost,
        platform = platform ?? (Platform.isIOS ? 'ios' : 'android');
  final PostFn _post;
  final String platform;
  final String base;
  final bool enabled;
  static const maxPerSession = 10;
  int _sent = 0;
  final Set<String> _seen = {};

  /// [kind]: 'flutter' for framework/zone errors, 'caught' for handled errors worth knowing about.
  /// [where] is a fixed label such as 'search' (never user input).
  Future<void> report(String kind, Object error, [StackTrace? stack, String? where]) async {
    try {
      if (!enabled || _sent >= maxPerSession) return;
      final message = scrub('${where == null ? '' : '[$where] '}${error is String ? error : '${error.runtimeType}: $error'}');
      final key = '$kind:$message';
      if (!_seen.add(key)) return;
      _sent++;
      final lines = (stack?.toString() ?? '').split('\n').where((l) => l.trim().isNotEmpty).take(20).join('\n');
      String os;
      try {
        os = '${Platform.operatingSystem} ${Platform.operatingSystemVersion}';
      } catch (_) {
        os = platform;
      }
      final body = jsonEncode({
        'kind': kind,
        'platform': platform,
        'message': message.length > 500 ? message.substring(0, 500) : message,
        'stack': _cut(scrub('os: $os\n$lines'), 2000),
        'release': appRelease,
      });
      await _post(Uri.parse(base).replace(queryParameters: {'op': 'log'}), body);
    } catch (_) {
      // reporting must never throw or loop
    }
  }

  static String _cut(String s, int n) => s.length > n ? s.substring(0, n) : s;
}

/// The one reporter the app uses. Off until main() switches it on, so tests never post anywhere.
ErrorReporter errorReporter = ErrorReporter(enabled: false, platform: 'android', post: (_, _) async {});

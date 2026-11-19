import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Production API (Vercel Function). Native HTTP has no CORS, so the absolute URL just works.
const String apiBase = String.fromEnvironment('API_BASE', defaultValue: 'https://rasta-sahilx.vercel.app/api');

class ApiError implements Exception {
  ApiError(this.status, this.code);
  final int status;
  final String code;
  @override
  String toString() => 'ApiError($status, $code)';
}

abstract class TokenStore {
  Future<String?> read();
  Future<void> write(String? token);
}

class PrefsTokenStore implements TokenStore {
  static const _key = 'deviceToken';
  @override
  Future<String?> read() async {
    try {
      return (await SharedPreferences.getInstance()).getString(_key);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> write(String? token) async {
    try {
      final p = await SharedPreferences.getInstance();
      token == null ? await p.remove(_key) : await p.setString(_key, token);
    } catch (_) {/* storage unavailable: a new anonymous token is minted next time */}
  }
}

typedef HttpSend = Future<http.Response> Function(String method, Uri url, Map<String, String> headers, String? body);

Future<http.Response> _defaultSend(String method, Uri url, Map<String, String> headers, String? body) async {
  final req = http.Request(method, url)..headers.addAll(headers);
  if (body != null) req.body = body;
  final streamed = await http.Client().send(req).timeout(const Duration(seconds: 10));
  return http.Response.fromStream(streamed);
}

/// Mirrors src/services/incidentsApi.ts: one anonymous, signed token per device.
class ApiClient {
  ApiClient({HttpSend? send, TokenStore? tokens, this.base = apiBase})
      : _send = send ?? _defaultSend,
        _tokens = tokens ?? PrefsTokenStore();
  final HttpSend _send;
  final TokenStore _tokens;
  final String base;

  Future<dynamic> request(String op, {String method = 'GET', Object? body, bool auth = true, Map<String, String> query = const {}}) async {
    final headers = <String, String>{};
    if (body != null) headers['content-type'] = 'application/json';
    final token = auth ? await _tokens.read() : null;
    if (token != null) headers['authorization'] = 'Bearer $token';
    final url = Uri.parse(base).replace(queryParameters: {'op': op, ...query});
    final http.Response res;
    try {
      res = await _send(method, url, headers, body == null ? null : jsonEncode(body));
    } catch (_) {
      throw ApiError(0, 'no_backend');
    }
    dynamic data;
    try {
      data = jsonDecode(utf8.decode(res.bodyBytes));
    } catch (_) {
      throw ApiError(res.statusCode, 'no_backend');
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiError(res.statusCode, data is Map && data['error'] is String ? data['error'] as String : 'error');
    }
    return data;
  }

  Future<dynamic> authed(String op, Object? body) async {
    for (var attempt = 0; attempt < 2; attempt++) {
      if (await _tokens.read() == null) {
        final s = await request('session', method: 'POST', auth: false);
        await _tokens.write((s as Map)['token'] as String?);
      }
      try {
        return await request(op, method: 'POST', body: body);
      } on ApiError catch (e) {
        if (e.status == 401 && attempt == 0) {
          await _tokens.write(null);
          continue;
        }
        rethrow;
      }
    }
    throw ApiError(401, 'unauthorized');
  }
}

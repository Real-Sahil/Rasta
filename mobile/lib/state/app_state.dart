import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:material_ui/material_ui.dart' show ThemeMode;
import 'package:shared_preferences/shared_preferences.dart';

import '../core/announcer.dart';
import '../core/geo.dart';
import '../core/navigation.dart';
import '../core/phrases.dart';
import '../core/route.dart';
import '../core/routing.dart';
import '../core/voice.dart';
import '../services/gps_service.dart';
import '../services/search_service.dart';
import '../services/speech_service.dart';

/// All app state in one place; widgets only read it and call its methods. Navigation maths lives in lib/core.
class AppState extends ChangeNotifier {
  AppState({GpsService? gps, SpeechService? speech, SearchService? search, this._get})
      : gps = gps ?? GpsService(),
        speech = speech ?? SpeechService(),
        search = search ?? SearchService();

  final GpsService gps;
  final SpeechService speech;
  final SearchService search;
  final GetFn? _get; // test hook for the HTTP client

  String lang = 'en';
  String skin = 'standard'; // optional look; see kSkins in ui/chamak.dart
  ThemeMode themeMode = ThemeMode.system;
  Fix? fix; // null until a real GPS fix
  GpsProblem gpsProblem = GpsProblem.none;
  Place? destination;
  Place? origin; // null = my location. A custom start gives a preview only.
  List<RouteOption> routes = const [];
  RouteSource? routeSource;
  int selected = 0;
  bool loadingRoutes = false;
  NavSession? session;
  bool navigating = false;
  String? noticeKey;
  final Set<String> _announced = {};
  int _routeSeq = 0;
  DateTime _lastReroute = DateTime.fromMillisecondsSinceEpoch(0);

  VoiceLang get voiceLang => toVoiceLang(lang);
  RouteOption? get route => routes.isEmpty ? null : routes[selected.clamp(0, routes.length - 1)];

  /// Where the vehicle is drawn: on the route line while navigating, else the raw fix.
  LatLng? get vehicle => session?.snapped ?? fix?.point;

  bool get muted => speech.muted;

  Future<void> _loadPrefs() async {
    try {
      final p = await SharedPreferences.getInstance();
      final saved = p.getString('skin') ?? ((p.getBool('skinChamak') ?? false) ? 'chamak' : 'standard');
      skin = const ['standard', 'luce', 'miniature', 'schematic', 'chamak', 'nastaliq'].contains(saved) ? saved : 'standard';
      themeMode = switch (p.getString('themeMode')) { 'light' => ThemeMode.light, 'dark' => ThemeMode.dark, _ => ThemeMode.system };
    } catch (_) {}
  }

  Future<void> setSkin(String v) async {
    skin = v;
    notifyListeners();
    try {
      (await SharedPreferences.getInstance()).setString('skin', v);
    } catch (_) {}
  }

  Future<void> setThemeMode(ThemeMode m) async {
    themeMode = m;
    notifyListeners();
    try {
      (await SharedPreferences.getInstance()).setString('themeMode', m.name);
    } catch (_) {}
  }

  Future<void> init() async {
    await _loadPrefs();
    await speech.init();
    gpsProblem = await gps.ensurePermission();
    if (gpsProblem == GpsProblem.none) _startGps(background: false);
    notifyListeners();
  }

  void _startGps({required bool background}) {
    gps.start(
      background: background,
      notificationTitle: 'Buraq navigation',
      notificationText: 'Using your location for turn-by-turn directions.',
      onFix: onFix,
      onError: (_) {
        gpsProblem = GpsProblem.serviceOff;
        notifyListeners();
      },
    );
  }

  void setLang(String l) {
    lang = l;
    notifyListeners();
  }

  void toggleMute() {
    speech.muted = !speech.muted;
    if (speech.muted) speech.stop();
    notifyListeners();
  }

  // ---------------------------------------------------------------- routes
  Future<void> setDestination(Place p) async {
    destination = p;
    await loadRoutes();
  }

  Future<void> setOrigin(Place? p) async {
    if (navigating) return; // never change the start mid-trip
    origin = p;
    await loadRoutes();
  }

  Future<void> swap() async {
    if (navigating || destination == null) return;
    final here = fix == null ? null : Place(id: 'me', name: 'me', detail: '', point: fix!.point);
    final oldDest = destination!;
    destination = origin ?? here;
    origin = oldDest;
    if (destination == null) {
      destination = oldDest;
      origin = null;
      return;
    }
    await loadRoutes();
  }

  void clear() {
    _routeSeq++;
    destination = null;
    origin = null;
    routes = const [];
    routeSource = null;
    selected = 0;
    loadingRoutes = false;
    noticeKey = null;
    stopNavigation();
  }

  LatLng? get _start => origin?.point ?? fix?.point;

  Future<void> loadRoutes() async {
    final dest = destination;
    final from = _start;
    noticeKey = null;
    if (dest == null) return;
    if (from == null) {
      routes = const [];
      noticeKey = 'noFix';
      notifyListeners();
      return;
    }
    final mine = ++_routeSeq;
    loadingRoutes = true;
    routes = const [];
    notifyListeners();
    try {
      final r = await fetchRoutes(
        RouteRequest(from: from, to: dest.point, destId: dest.id, fromId: origin?.id, mode: TravelMode.driving),
        get: _get,
        isCancelled: () => mine != _routeSeq,
      );
      if (mine != _routeSeq) return; // a newer request replaced this one
      routes = r.routes;
      routeSource = r.source;
      selected = 0;
      noticeKey = r.source == RouteSource.estimate ? 'estimate' : null;
    } on RouteCancelled {
      return;
    } finally {
      if (mine == _routeSeq) {
        loadingRoutes = false;
        notifyListeners();
      }
    }
  }

  void selectRoute(int i) {
    if (navigating) return;
    selected = i;
    notifyListeners();
  }

  // ---------------------------------------------------------------- navigation
  /// Returns a notice key when navigation can't start, else null.
  String? startNavigation() {
    final r = route;
    if (r == null) return 'noFix';
    if (origin != null) {
      noticeKey = 'previewOnly';
      notifyListeners();
      return noticeKey;
    }
    if (fix == null) {
      noticeKey = 'noFix';
      notifyListeners();
      return noticeKey;
    }
    noticeKey = null;
    navigating = true;
    _announced.clear();
    session = createSession(r);
    _startGps(background: true); // foreground service / background updates only while navigating
    final a = simpleAnnouncement('${r.id}:start', 'start');
    _announced.add(a.key);
    speech.speak(a, voiceLang, force: true);
    onFix(fix!);
    notifyListeners();
    return null;
  }

  void stopNavigation() {
    if (!navigating && session == null) return;
    navigating = false;
    session = null;
    _announced.clear();
    speech.stop();
    if (gpsProblem == GpsProblem.none) _startGps(background: false);
    notifyListeners();
  }

  void onFix(Fix f) {
    fix = f;
    final r = route;
    var s = session;
    if (navigating && r != null && s != null) {
      s = updateSession(s, r, f);
      session = s;
      final a = nextAnnouncement(s, r, _announced);
      if (a != null) {
        _announced.add(a.key);
        speech.speak(a, voiceLang);
      }
      if (s.status == NavStatus.arrived) {
        gps.stop();
      } else if (s.status == NavStatus.offRoute) {
        _reroute(f);
      }
    }
    notifyListeners();
  }

  Future<void> _reroute(Fix f) async {
    final dest = destination;
    if (dest == null || DateTime.now().difference(_lastReroute).inSeconds < 15) return;
    _lastReroute = DateTime.now();
    final mine = ++_routeSeq;
    try {
      final r = await fetchRoutes(
        RouteRequest(from: f.point, to: dest.point, destId: dest.id, mode: TravelMode.driving),
        get: _get,
        isCancelled: () => mine != _routeSeq,
      );
      if (mine != _routeSeq || !navigating) return;
      routes = r.routes;
      routeSource = r.source;
      selected = 0;
      session = createSession(r.routes.first);
      final a = simpleAnnouncement('${r.routes.first.id}:reroute:${DateTime.now().millisecondsSinceEpoch}', 'reroute');
      _announced.add(a.key);
      speech.speak(a, voiceLang, force: true);
      notifyListeners();
    } on RouteCancelled {
      return;
    }
  }

  @override
  void dispose() {
    gps.stop();
    speech.stop();
    super.dispose();
  }
}

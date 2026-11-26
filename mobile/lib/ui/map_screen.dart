import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/services.dart' show rootBundle;
import 'package:maplibre_gl/maplibre_gl.dart' as ml;
import 'package:material_ui/material_ui.dart';
import 'package:share_plus/share_plus.dart';

import '../core/coverage.dart';
import '../core/flood.dart';
import '../core/saved_places.dart';
import '../core/geo.dart';
import '../core/hud.dart';
import '../core/navigation.dart';
import '../core/routing.dart' show RouteSource;
import '../core/share_trip.dart';
import '../core/skin_hud.dart';
import '../core/voice.dart';
import '../core/fares.dart' show inLahoreArea;
import '../l10n.dart';
import 'chamak.dart';
import 'fare_compare.dart';
import 'motion.dart';
import '../services/gps_service.dart';
import '../services/error_reporter.dart';
import '../services/search_service.dart';
import '../state/app_state.dart';

const _style = 'https://tiles.openfreemap.org/styles/liberty';

ml.LatLng _ll(LatLng p) => ml.LatLng(p.lat, p.lng);

/// Point [meters] ahead of [p] along [bearing] (degrees). Used to keep the vehicle low on screen while driving.
LatLng pointAhead(LatLng p, double bearing, double meters) {
  final b = bearing * math.pi / 180;
  final dLat = meters * math.cos(b) / 111195;
  final dLng = meters * math.sin(b) / (111195 * math.cos(p.lat * math.pi / 180));
  return LatLng(p.lat + dLat, p.lng + dLng);
}

class MapScreen extends StatefulWidget {
  const MapScreen({super.key, required this.app});
  final AppState app;
  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  ml.MapLibreMapController? _map;
  bool _styleReady = false;
  ml.Line? _routeLine;
  String? _routeLineId;
  ml.Circle? _vehicle;
  bool _freeLook = false;
  Timer? _freeLookTimer;
  Offset? _pointerStart;
  bool _centeredOnce = false;
  double _bearing = 0;
  bool _flood = false;
  bool _floodFailed = false;
  List<FloodEvent>? _floodEvents; // loaded the first time the layer is switched on
  final List<String> _floodIds = [];

  AppState get app => widget.app;

  @override
  void initState() {
    super.initState();
    app.addListener(_sync);
  }

  @override
  void dispose() {
    app.removeListener(_sync);
    _freeLookTimer?.cancel();
    super.dispose();
  }

  bool _syncing = false, _syncAgain = false;

  /// Map calls are async: two overlapping runs both saw `_vehicle == null` and each added a dot (two blue dots).
  /// Run one at a time and replay once if something changed meanwhile.
  Future<void> _sync() async {
    if (_syncing) {
      _syncAgain = true;
      return;
    }
    _syncing = true;
    try {
      do {
        _syncAgain = false;
        await _syncOnce();
      } while (_syncAgain && mounted);
    } finally {
      _syncing = false;
    }
  }

  Future<void> _syncOnce() async {
    final map = _map;
    final logicalHeight = mounted ? MediaQuery.of(context).size.height : 800.0;
    if (map == null || !_styleReady || !mounted) return;
    try {
      // route line (re-drawn only when the route identity changes)
      final r = app.route;
      if (r?.id != _routeLineId) {
        if (_routeLine != null) await map.removeLine(_routeLine!);
        _routeLine = null;
        _routeLineId = r?.id;
        if (r != null) {
          _routeLine = await map.addLine(ml.LineOptions(geometry: r.path.map(_ll).toList(), lineColor: '#059669', lineWidth: 6, lineOpacity: 0.9));
          if (!app.navigating) await _fitRoute(r.path);
        }
      }
      // vehicle dot
      final v = app.vehicle;
      if (v != null) {
        final opts = ml.CircleOptions(geometry: _ll(v), circleRadius: 9, circleColor: '#2563eb', circleStrokeColor: '#ffffff', circleStrokeWidth: 3);
        if (_vehicle == null) {
          _vehicle = await map.addCircle(opts);
        } else {
          await map.updateCircle(_vehicle!, opts);
        }
        if (!_centeredOnce && !app.navigating && app.route == null) {
          _centeredOnce = true;
          await map.animateCamera(ml.CameraUpdate.newLatLngZoom(_ll(v), 15));
        }
      }
      // camera follow while driving
      if (app.navigating && !_freeLook && v != null) {
        final h = app.fix?.heading;
        final speed = app.fix?.speed;
        if (h != null && (speed == null || speed >= 1)) _bearing = h; // ignore compass noise when stopped
        const zoom = 17.0;
        final mpp = 156543.03 * math.cos(v.lat * math.pi / 180) / math.pow(2, zoom);
        final target = pointAhead(v, _bearing, mpp * logicalHeight * 0.22); // vehicle sits ~22% below centre
        await map.animateCamera(
          ml.CameraUpdate.newCameraPosition(ml.CameraPosition(target: _ll(target), zoom: zoom, bearing: _bearing, tilt: 45)),
          duration: const Duration(milliseconds: 900),
        );
      }
    } catch (_) {
      // map calls can fail while the platform view is being torn down; the next update retries
    }
  }

  /// Past-flooding layer (UNOSAT, historical only). The data is bundled but parsed only when first switched on.
  Future<void> _toggleFlood(bool on) async {
    setState(() {
      _flood = on;
      _floodFailed = false;
    });
    if (on && _floodEvents == null) {
      try {
        final ev = parseFlood(await rootBundle.loadString('assets/flood/lahore.json'));
        if (ev.isEmpty) throw StateError('no flood events');
        _floodEvents = ev;
      } catch (_) {
        if (mounted) {
          setState(() {
            _flood = false;
            _floodFailed = true;
          });
        }
        return;
      }
    }
    await _applyFlood();
  }

  Future<void> _applyFlood() async {
    final map = _map;
    if (map == null || !_styleReady) return;
    try {
      for (final id in _floodIds) {
        await map.removeLayer('$id-fill');
        await map.removeSource(id);
      }
      _floodIds.clear();
      final ev = _floodEvents;
      if (!_flood || ev == null) return;
      for (var i = 0; i < ev.length; i++) {
        final id = 'buraq-flood-$i';
        await map.addGeoJsonSource(id, floodGeoJson(ev[i]));
        await map.addFillLayer(id, '$id-fill', ml.FillLayerProperties(fillColor: floodColours[i % floodColours.length], fillOpacity: 0.4));
        _floodIds.add(id);
      }
    } catch (_) {
      // style not ready or being torn down; toggling again retries
    }
  }

  Future<void> _fitRoute(List<LatLng> path) async {
    if (path.isEmpty || _map == null) return;
    var minLat = path.first.lat, maxLat = path.first.lat, minLng = path.first.lng, maxLng = path.first.lng;
    for (final p in path) {
      minLat = math.min(minLat, p.lat);
      maxLat = math.max(maxLat, p.lat);
      minLng = math.min(minLng, p.lng);
      maxLng = math.max(maxLng, p.lng);
    }
    await _map!.animateCamera(ml.CameraUpdate.newLatLngBounds(
      ml.LatLngBounds(southwest: ml.LatLng(minLat, minLng), northeast: ml.LatLng(maxLat, maxLng)),
      left: 40, right: 40, top: 220, bottom: 260,
    ));
  }

  Future<void> _locate() async {
    final v = app.vehicle;
    if (v == null || _map == null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr(app.lang, 'noFix'))));
      return;
    }
    try {
      await _map!.animateCamera(ml.CameraUpdate.newLatLngZoom(_ll(v), 16));
    } catch (_) {}
  }

  void _enterFreeLook() {
    if (!app.navigating) return;
    setState(() => _freeLook = true);
    _freeLookTimer?.cancel();
    _freeLookTimer = Timer(const Duration(seconds: 10), _recenter);
  }

  void _recenter() {
    _freeLookTimer?.cancel();
    if (mounted) setState(() => _freeLook = false);
    _sync();
  }

  @override
  Widget build(BuildContext context) {
    // The map is built once here and handed to the builder unchanged, so a GPS fix (once a second while driving)
    // rebuilds the overlays and HUD but never the native map widget.
    final map = Listener(
      onPointerDown: (e) => _pointerStart = e.position,
      onPointerMove: (e) {
        final s = _pointerStart;
        if (s != null && (e.position - s).distance > 12) _enterFreeLook();
      },
      child: ml.MapLibreMap(
        styleString: _style,
        initialCameraPosition: const ml.CameraPosition(target: ml.LatLng(30.3753, 69.3451), zoom: 4.5), // whole of Pakistan, not a city
        onMapCreated: (c) => _map = c,
        onStyleLoadedCallback: () {
          _styleReady = true;
          _floodIds.clear(); // a (re)loaded style has none of our layers
          _applyFlood();
          _sync();
        },
        compassEnabled: false,
        attributionButtonPosition: ml.AttributionButtonPosition.bottomLeft,
        // The "i" button is moved off-screen; a plain "© OpenStreetMap" line below keeps the ODbL credit visible.
        attributionButtonMargins: const math.Point(-200, -200),
      ),
    );
    return ListenableBuilder(
      listenable: app,
      child: map,
      builder: (context, map) {
        final lang = app.lang;
        return Scaffold(
          body: Stack(children: [
            map!,
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: SlideSwitcher(child: app.navigating ? NavHud(app: app) : SearchPanel(app: app)),
              ),
            ),
            if (app.navigating || app.destination == null)
              const PositionedDirectional(start: 8, bottom: 6, child: SafeArea(child: _OsmCredit())),
            // Browsing only: once a destination is chosen the bottom of the screen belongs to the route sheet (these used
            // to sit at a guessed offset and overlap a tall sheet and the GPS notice).
            if (!app.navigating && app.destination == null)
              Positioned(
                right: 12,
                bottom: 24,
                child: SafeArea(
                  child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                    FloatingActionButton.small(heroTag: 'locate', tooltip: tr(lang, 'myLocation'), onPressed: _locate, child: const Icon(Icons.my_location)),
                    const SizedBox(height: 8),
                    _FloodPanel(lang: lang, on: _flood, failed: _floodFailed, events: _floodEvents, onChanged: _toggleFlood),
                  ]),
                ),
              ),
            if (_freeLook && app.navigating)
              Positioned(
                bottom: 24,
                left: 0,
                right: 0,
                child: Center(child: FilledButton.icon(onPressed: _recenter, icon: const Icon(Icons.navigation), label: Text(tr(lang, 'recenter')))),
              ),
            if (!app.navigating && app.route != null) Align(alignment: Alignment.bottomCenter, child: RouteSheet(app: app)),
            // A destination without a route yet: say what is happening (loading, or waiting for GPS) instead of nothing.
            if (!app.navigating && app.destination != null && app.route == null)
              Align(alignment: Alignment.bottomCenter, child: _RouteStatus(lang: lang, loading: app.loadingRoutes, noticeKey: app.noticeKey)),
          ]),
        );
      },
    );
  }
}

class _FloodPanel extends StatelessWidget {
  const _FloodPanel({required this.lang, required this.on, required this.failed, required this.events, required this.onChanged});
  final String lang;
  final bool on, failed;
  final List<FloodEvent>? events;
  final ValueChanged<bool> onChanged;
  @override
  Widget build(BuildContext context) {
    final ev = events ?? const <FloodEvent>[];
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 300),
      child: Material(
        elevation: 3,
        borderRadius: BorderRadius.circular(12),
        color: Theme.of(context).colorScheme.surface,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(mainAxisSize: MainAxisSize.min, children: [
              Flexible(child: Text(tr(lang, 'floodLayer'))),
              Switch(value: on, onChanged: onChanged),
            ]),
            if (failed) Text(tr(lang, 'floodFail'), style: const TextStyle(color: Colors.red)),
            if (on) ...[
              for (var i = 0; i < ev.length && i < 2; i++)
                Row(children: [
                  Container(width: 14, height: 14, color: Color(int.parse('ff${floodColours[i % floodColours.length].substring(1)}', radix: 16)).withValues(alpha: 0.6)),
                  const SizedBox(width: 6),
                  Expanded(child: Text(tr(lang, 'floodEvent${i + 1}'), style: Theme.of(context).textTheme.bodySmall)),
                ]),
              const SizedBox(height: 4),
              Text(tr(lang, 'floodNote'), style: Theme.of(context).textTheme.bodySmall),
              Text(tr(lang, 'floodCredit'), style: Theme.of(context).textTheme.bodySmall),
            ],
          ]),
        ),
      ),
    );
  }
}

class _RouteStatus extends StatelessWidget {
  const _RouteStatus({required this.lang, required this.loading, required this.noticeKey});
  final String lang;
  final bool loading;
  final String? noticeKey;
  @override
  Widget build(BuildContext context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Entrance(dy: 16, child: loading
              ? Material(
                  elevation: 4,
                  borderRadius: BorderRadius.circular(20),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(children: [
                      const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5)),
                      const SizedBox(width: 12),
                      Expanded(child: Text(tr(lang, 'routeLoading'))),
                    ]),
                  ),
                )
              : (noticeKey == null ? const SizedBox.shrink() : _Notice(text: tr(lang, noticeKey!)))),
        ),
      );
}

class _Notice extends StatelessWidget {
  const _Notice({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) => Material(
        color: Colors.amber.shade100,
        elevation: 3,
        borderRadius: BorderRadius.circular(12),
        child: Padding(padding: const EdgeInsets.all(12), child: Text(text, style: const TextStyle(color: Colors.black87))),
      );
}

String formatDistance(double m, String lang) =>
    m >= 1000 ? '${(m / 1000).toStringAsFixed(1)} ${tr(lang, 'km')}' : '${(m / 10).round() * 10} ${tr(lang, 'm')}';
String formatMinutes(int s, String lang) => '${math.max(1, (s / 60).round())} ${tr(lang, 'min')}';

// ------------------------------------------------------------------ search
class SearchPanel extends StatefulWidget {
  const SearchPanel({super.key, required this.app});
  final AppState app;
  @override
  State<SearchPanel> createState() => _SearchPanelState();
}

class _SearchPanelState extends State<SearchPanel> {
  final _to = TextEditingController();
  final _from = TextEditingController();
  final _toFocus = FocusNode();
  bool _toFocused = false;
  List<Place> _results = const [];
  bool _forFrom = false;
  bool _hadRoute = false;
  Timer? _debounce;
  String? _error;

  AppState get app => widget.app;

  @override
  void initState() {
    super.initState();
    _toFocus.addListener(() {
      if (mounted) setState(() => _toFocused = _toFocus.hasFocus);
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _toFocus.dispose();
    _to.dispose();
    _from.dispose();
    super.dispose();
  }

  void _onChanged(String q, bool forFrom) {
    _forFrom = forFrom;
    if (q.trim().isEmpty) {
      // back to an empty box: drop stale results/errors so the saved places show again
      _debounce?.cancel();
      setState(() {
        _results = const [];
        _error = null;
      });
      return;
    }
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 450), () async {
      try {
        final r = await app.search.search(q, near: app.fix?.point, lang: app.lang);
        if (r == null || !mounted) return;
        setState(() {
          _results = r;
          _error = r.isEmpty && q.trim().length >= 2 ? 'noResults' : null;
        });
      } on SearchException catch (e) {
        // the query itself is never reported, only the kind of failure
        errorReporter.report('caught', '${e.busy ? 'busy' : 'offline'}: ${e.detail}', null, 'search');
        if (mounted) setState(() { _results = const []; _error = e.busy ? 'searchBusy' : 'offline'; });
      } catch (e, st) {
        errorReporter.report('caught', e, st, 'search');
        if (mounted) setState(() { _results = const []; _error = 'searchBusy'; });
      }
    });
  }

  Future<void> _pick(Place p) async {
    FocusScope.of(context).unfocus();
    setState(() => _results = const []);
    if (_forFrom) {
      _from.text = p.name;
      await app.setOrigin(p);
    } else {
      _to.text = p.name;
      await app.setDestination(p);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = app.lang;
    final hasRoute = app.destination != null;
    // Clear the fields only when a route has just been cleared. (Clearing on every rebuild without a route erased
    // whatever the user was typing each time the GPS fix or any other state changed.)
    if (_hadRoute && !hasRoute) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _to.clear();
        _from.clear();
      });
    }
    _hadRoute = hasRoute;
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Material(
        elevation: 4,
        borderRadius: BorderRadius.circular(22),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            if (hasRoute)
              Row(children: [
                const Icon(Icons.my_location, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _from,
                    decoration: InputDecoration(hintText: app.origin == null ? tr(lang, 'yourLocation') : tr(lang, 'fromHint'), border: InputBorder.none, isDense: true),
                    onChanged: (q) => _onChanged(q, true),
                  ),
                ),
                if (app.origin != null)
                  IconButton(
                    tooltip: tr(lang, 'yourLocation'),
                    icon: const Icon(Icons.gps_fixed),
                    onPressed: () {
                      _from.clear();
                      app.setOrigin(null);
                    },
                  ),
              ]),
            Row(children: [
              const Icon(Icons.place, size: 20, color: Colors.red),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _to,
                  focusNode: _toFocus,
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(hintText: tr(lang, 'searchHint'), border: InputBorder.none, isDense: true),
                  onChanged: (q) => _onChanged(q, false),
                ),
              ),
              if (hasRoute) ...[
                IconButton(tooltip: tr(lang, 'swap'), icon: const Icon(Icons.swap_vert), onPressed: () async {
                  await app.swap();
                  _to.text = app.destination?.name == 'me' ? tr(lang, 'yourLocation') : (app.destination?.name ?? '');
                  _from.text = app.origin?.name == 'me' ? '' : (app.origin?.name ?? '');
                }),
                IconButton(tooltip: tr(lang, 'clear'), icon: const Icon(Icons.close), onPressed: app.clear),
              ],
              PopupMenuButton<String>(
                icon: const Icon(Icons.translate),
                onSelected: app.setLang,
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'en', child: Text('English')),
                  PopupMenuItem(value: 'ur', child: Text('اردو')),
                  PopupMenuItem(value: 'pa', child: Text('پنجابی')),
                ],
              ),
            ]),
          ]),
        ),
      ),
      if (_results.isNotEmpty)
        Material(
          elevation: 4,
          borderRadius: BorderRadius.circular(22),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 300),
            child: ListView(shrinkWrap: true, padding: EdgeInsets.zero, children: [
              for (final p in _results) ListTile(dense: true, leading: const Icon(Icons.place_outlined), title: Text(p.name, maxLines: 1, overflow: TextOverflow.ellipsis), subtitle: Text(p.detail, maxLines: 1, overflow: TextOverflow.ellipsis), onTap: () => _pick(p)),
            ]),
          ),
        ),
      if (_results.isEmpty && _toFocused && _to.text.trim().isEmpty && !app.places.isEmpty)
        _SavedList(app: app, onPick: (p) {
          _forFrom = false;
          _pick(p);
        }),
      if (outsidePakistan(app.fix?.point)) Padding(padding: const EdgeInsets.only(top: 8), child: _Notice(text: tr(lang, 'outsidePk'))),
      // Plain words only: the technical detail goes to the error report, not to the person searching.
      if (_error != null && _results.isEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: _Notice(text: tr(lang, _error!))),
      if (app.gpsProblem != GpsProblem.none) Padding(padding: const EdgeInsets.only(top: 8), child: _Notice(text: tr(lang, 'permission'))),
    ]);
  }
}

/// Home, Work and recent destinations, shown when the destination box is focused and empty. Device-only data.
class _SavedList extends StatelessWidget {
  const _SavedList({required this.app, required this.onPick});
  final AppState app;
  final ValueChanged<Place> onPick;

  @override
  Widget build(BuildContext context) {
    final lang = app.lang;
    final pl = app.places;
    Widget tile(Place p, IconData icon, String? label, VoidCallback onRemove) => ListTile(
          key: ValueKey('saved-${label ?? 'recent'}-${p.id}'),
          dense: true,
          leading: Icon(icon),
          title: Text(label ?? p.name, maxLines: 1, overflow: TextOverflow.ellipsis),
          subtitle: Text(label == null ? p.detail : p.name, maxLines: 1, overflow: TextOverflow.ellipsis),
          onTap: () => onPick(p),
          onLongPress: () async {
            final ok = await showDialog<bool>(
              context: context,
              builder: (c) => AlertDialog(
                content: Text(label ?? p.name),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(lang, 'cancel'))),
                  FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr(lang, 'removePlace'))),
                ],
              ),
            );
            if (ok == true) onRemove();
          },
        );
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Material(
        elevation: 4,
        borderRadius: BorderRadius.circular(22),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 320),
          child: ListView(shrinkWrap: true, padding: const EdgeInsets.symmetric(vertical: 4), children: [
            if (pl.home != null) tile(pl.home!, Icons.home_outlined, tr(lang, 'placeHome'), () => app.setHome(null)),
            if (pl.work != null) tile(pl.work!, Icons.work_outline, tr(lang, 'placeWork'), () => app.setWork(null)),
            if (pl.recent.isNotEmpty)
              Padding(padding: const EdgeInsets.fromLTRB(16, 6, 16, 0), child: Text(tr(lang, 'recentTitle'), style: Theme.of(context).textTheme.labelMedium)),
            for (final p in pl.recent) tile(p, Icons.history, null, () => app.forgetRecent(p)),
            Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 8), child: Text(tr(lang, 'savedNote'), style: Theme.of(context).textTheme.bodySmall)),
          ]),
        ),
      ),
    );
  }
}

// ------------------------------------------------------------------ route sheet
class RouteSheet extends StatelessWidget {
  const RouteSheet({super.key, required this.app});
  final AppState app;

  @override
  Widget build(BuildContext context) {
    final lang = app.lang;
    final r = app.route!;
    final support = app.speech.support(app.voiceLang);
    // At most ~half the screen: in Urdu or with large text the sheet used to grow over the search box and push Start away.
    // Slides up once when the first route arrives; switching between routes doesn't replay it.
    return Entrance(dy: 32, child: ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.55),
      child: Material(
      elevation: 8,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Flexible(
              child: SingleChildScrollView(
                child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (app.routes.length > 1)
              Wrap(spacing: 8, children: [
                for (var i = 0; i < app.routes.length; i++) ChoiceChip(label: Text('${app.routes[i].durationMinutes} ${tr(lang, 'min')} · ${app.routes[i].distanceKm} ${tr(lang, 'km')}'), selected: app.selected == i, onSelected: (_) => app.selectRoute(i)),
              ]),
            const SizedBox(height: 6),
            Text('${r.durationMinutes} ${tr(lang, 'min')}  ·  ${r.distanceKm} ${tr(lang, 'km')}', style: Theme.of(context).textTheme.headlineSmall),
            Text(lang == 'en' ? r.via : r.viaUrdu, maxLines: 2, overflow: TextOverflow.ellipsis),
            if (app.destination != null && app.destination!.id != 'me')
              Wrap(spacing: 4, children: [
                TextButton.icon(
                  icon: const Icon(Icons.home_outlined, size: 18),
                  label: Text(tr(lang, 'setHome')),
                  onPressed: app.places.home != null && SavedPlaces.same(app.places.home!, app.destination!) ? null : () => app.setHome(app.destination),
                ),
                TextButton.icon(
                  icon: const Icon(Icons.work_outline, size: 18),
                  label: Text(tr(lang, 'setWork')),
                  onPressed: app.places.work != null && SavedPlaces.same(app.places.work!, app.destination!) ? null : () => app.setWork(app.destination),
                ),
              ]),
            if (app.noticeKey != null) Padding(padding: const EdgeInsets.only(top: 8), child: _Notice(text: tr(lang, app.noticeKey!))),
            if (support.status == VoiceStatus.none) Padding(padding: const EdgeInsets.only(top: 8), child: _Notice(text: tr(lang, 'noVoice'))),
            if (support.status == VoiceStatus.approximate) Padding(padding: const EdgeInsets.only(top: 8), child: _Notice(text: tr(lang, 'approxVoice'))),
            if (lang != 'en') Padding(padding: const EdgeInsets.only(top: 8), child: Text(tr(lang, 'draft'), style: Theme.of(context).textTheme.bodySmall)),
            if (app.routeSource == RouteSource.network && (app.origin?.point ?? app.fix?.point) != null)
              FareCompare(lang: lang, route: r, lahore: inLahoreArea(app.origin?.point ?? app.fix!.point)),
                ]),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: app.loadingRoutes ? null : () => app.startNavigation(),
                icon: const Icon(Icons.navigation),
                label: Text(tr(lang, 'start')),
              ),
            ),
          ]),
        ),
      ),
      ),
    ));
  }
}

// ------------------------------------------------------------------ driving HUD
class NavHud extends StatelessWidget {
  const NavHud({super.key, required this.app});
  final AppState app;

  IconData _icon(String m) => switch (m) {
        'turn-left' => Icons.turn_left,
        'turn-right' => Icons.turn_right,
        'u-turn' => Icons.u_turn_left,
        'roundabout' => Icons.roundabout_left,
        'merge' => Icons.merge,
        'arrive' => Icons.flag,
        _ => Icons.arrow_upward,
      };

  @override
  Widget build(BuildContext context) {
    final lang = app.lang;
    final s = app.session;
    final r = app.route;
    if (s == null || r == null) return const SizedBox.shrink();
    final arrived = s.status == NavStatus.arrived;
    final off = s.status == NavStatus.offRoute;
    final step = r.steps.isEmpty ? null : r.steps[s.upcomingStepIndex.clamp(0, r.steps.length - 1)];
    final skinned = app.skin != 'standard';
    final isCk = app.skin == 'chamak';
    final pal = skinPalette(app.skin, Theme.of(context).brightness);
    // Quieter at speed: past 30 km/h the decoration shrinks so only the turn and distance stand out.
    final speedKmh = app.fix?.speed == null ? null : app.fix!.speed! * 3.6;
    final calm = isCk && speedKmh != null && speedKmh >= 30;
    final cardBg = skinned ? pal.card : BuraqTokens.hud;
    final sub = skinned ? pal.sub : Colors.white.withValues(alpha: 0.82);
    final dist = skinned ? pal.accent : Colors.white;
    final radius = app.skin == 'schematic' ? 4.0 : (app.skin == 'miniature' ? 10.0 : 16.0);
    final then = thenPhrase(s, r);
    final progress = tripProgress(s);
    final icon = Icon(arrived ? Icons.flag : _icon(step?.maneuver ?? 'straight'), color: skinned ? pal.onBadge : BuraqTokens.hud, size: skinned ? 40 : 34);
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Material(
        color: cardBg,
        elevation: 6,
        borderRadius: skinned ? null : BorderRadius.circular(26),
        clipBehavior: Clip.antiAlias,
        shape: skinned ? RoundedRectangleBorder(borderRadius: BorderRadius.circular(radius), side: BorderSide(color: pal.accent, width: 2)) : null,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (isCk) ChamakStrip(height: calm ? 4 : 10, opacity: calm ? 0.5 : 1),
          Padding(
            padding: const EdgeInsets.all(14),
            // Keyed by manoeuvre: a new turn slides in from the reading side; the distance updates in place.
            child: SlideSwitcher(
              alignment: AlignmentDirectional.centerStart,
              from: Offset(Directionality.of(context) == TextDirection.rtl ? -0.08 : 0.08, 0),
              child: Row(key: ValueKey('step-${s.upcomingStepIndex}-$arrived-$off'), children: [
              if (app.skin == 'luce')
                LuceDial(progress: dialProgress(s.distanceToManeuverM), lit: pal.accent, dim: pal.rule, child: Icon(arrived ? Icons.flag : _icon(step?.maneuver ?? 'straight'), color: pal.accent, size: 36))
              else if (skinned && app.skin != 'nastaliq')
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: pal.badge,
                    shape: app.skin == 'luce' ? BoxShape.circle : BoxShape.rectangle,
                    borderRadius: app.skin == 'luce' ? null : BorderRadius.circular(app.skin == 'schematic' ? 0 : 16),
                    border: Border.all(color: pal.accent, width: 2),
                  ),
                  child: icon,
                )
              else if (!skinned)
                // Standard: road-yellow turn tile, the one bright thing on the card.
                Container(width: 56, height: 56, decoration: BoxDecoration(color: BuraqTokens.signal, borderRadius: BorderRadius.circular(18)), child: icon)
              else
                icon,
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  if (app.skin == 'nastaliq' && !off)
                    Directionality(
                      textDirection: (lang == 'ur' || lang == 'pa') ? TextDirection.rtl : TextDirection.ltr,
                      child: SizedBox(width: double.infinity, child: Text(arrived ? tr(lang, 'arrived') : posterWord(step?.maneuver ?? 'straight', lang), key: const Key('poster-word'), style: TextStyle(color: pal.accent, fontSize: 44, height: 1.6, fontWeight: FontWeight.bold))),
                    ),
                  Text(arrived ? tr(lang, 'arrived') : (off ? tr(lang, 'offRoute') : formatDistance(s.distanceToManeuverM, lang)), style: TextStyle(color: dist, fontSize: app.skin == 'luce' ? 30 : (skinned ? 26 : 32), fontWeight: app.skin == 'luce' ? FontWeight.w200 : (skinned ? FontWeight.bold : FontWeight.w800), fontFeatures: const [FontFeature.tabularFigures()], height: 1.1)),
                  if (!arrived && !off && step != null) Text(lang == 'en' ? step.instruction : step.instructionUrdu, style: TextStyle(color: sub, fontSize: 15), maxLines: 2, overflow: TextOverflow.ellipsis),
                  if (then != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(thenText(then, app.voiceLang, tr(lang, 'hudThen')), key: const Key('hud-then'), style: TextStyle(color: sub.withValues(alpha: 0.75), fontSize: 13, fontWeight: FontWeight.w700)),
                    ),
                ]),
              ),
            ]),
            ),
          ),
          // Trip progress: fills as the remaining distance shrinks; animates only the width, nothing loops.
          Semantics(
            label: tr(lang, 'tripProgress'),
            value: '${(progress * 100).round()}%',
            child: TweenAnimationBuilder<double>(
              tween: Tween(end: progress),
              duration: motionMs(context, 700),
              curve: kEaseOut,
              builder: (_, v, _) => LinearProgressIndicator(value: v, minHeight: 4, backgroundColor: Colors.white.withValues(alpha: skinned ? 0.0 : 0.1), color: skinned ? pal.accent : const Color(0xFF1DAE72)),
            ),
          ),
        ]),
      ),
      const SizedBox(height: 8),
      Material(
        elevation: 4,
        borderRadius: BorderRadius.circular(skinned ? 14 : 999),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Row(children: [
            Expanded(child: Text('${formatMinutes(s.remainingS, lang)}  ·  ${formatDistance(s.remainingM, lang)}', style: Theme.of(context).textTheme.titleMedium)),
            IconButton(tooltip: tr(lang, app.muted ? 'unmute' : 'mute'), icon: Icon(app.muted ? Icons.volume_off : Icons.volume_up), onPressed: app.toggleMute),
            IconButton(
              tooltip: tr(lang, 'share'),
              icon: const Icon(Icons.share),
              onPressed: () {
                final pos = app.vehicle;
                if (pos == null) return;
                final text = buildTripShareText(tr(lang, 'shareMsg'), dest: app.destination?.name ?? '', remainingS: s.remainingS, pos: pos);
                SharePlus.instance.share(ShareParams(text: text)); // one-off snapshot, not live tracking
              },
            ),
            IconButton(tooltip: tr(lang, 'clear'), icon: const Icon(Icons.close), onPressed: app.clear),
          ]),
        ),
      ),
    ]);
  }
}

/// Required OpenStreetMap credit (ODbL), shown as quiet text instead of the map engine's "i" button.
class _OsmCredit extends StatelessWidget {
  const _OsmCredit();
  @override
  Widget build(BuildContext context) {
    final t = BuraqTokens.of(Theme.of(context).brightness);
    return DecoratedBox(
      decoration: BoxDecoration(color: t.surface.withValues(alpha: 0.8), borderRadius: BorderRadius.circular(6)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        child: Text('© OpenStreetMap', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w500, color: t.ink2)),
      ),
    );
  }
}

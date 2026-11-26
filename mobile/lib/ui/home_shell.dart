import 'package:material_ui/material_ui.dart';

import '../l10n.dart';
import '../services/reports_api.dart';
import '../state/app_state.dart';
import '../state/app_watch.dart';
import 'chamak.dart';
import 'emergency_screen.dart';
import 'incidents_screen.dart';
import 'info_screen.dart';
import 'map_screen.dart';
import 'motion.dart';
import 'transit_screen.dart';

/// Five tabs. The bar hides while navigating so the HUD keeps the whole screen. IndexedStack keeps the map alive.
///
/// For low-memory phones: a tab is built the first time it is opened, not at start-up (then kept, so it doesn't
/// reload), and while driving the shell ignores GPS fixes. Only the map screen follows them, for the HUD.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.app, required this.api});
  final AppState app;
  final ReportsApi api;
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tab = 0;
  final Set<int> _opened = {0};
  int _browseTick = 0;

  void _open(int i) => setState(() {
        _tab = i;
        _opened.add(i);
      });

  /// While driving the other tabs are hidden, so only these change what the shell shows. While browsing every change
  /// counts (AppState already throttles fixes to one every 2 s then), so the tabs still see a new fix or saved place.
  Object? _watch(AppState a) => a.navigating ? (a.lang, a.skin) : ++_browseTick;

  Widget _lazy(int i, Widget Function() build) => _opened.contains(i) ? build() : const SizedBox.shrink();

  @override
  Widget build(BuildContext context) {
    final app = widget.app;
    final lang = app.lang;
    return AppWatch(
      app: app,
      select: _watch,
      builder: (context, _) {
        final tab = app.navigating ? 0 : _tab;
        return Scaffold(
          body: IndexedStack(index: tab, children: [
            MapScreen(app: app),
            // The map is a native view, so it never fades; the other tabs rise in when chosen.
            _lazy(1, () => TabEntrance(active: tab == 1, child: IncidentsScreen(app: app, api: widget.api, active: tab == 1))),
            _lazy(2, () => TabEntrance(active: tab == 2, child: TransitScreen(app: app, api: widget.api, active: tab == 2, onRouteTo: () => _open(0)))),
            _lazy(3, () => TabEntrance(active: tab == 3, child: EmergencyScreen(app: app, onRouteTo: () => _open(0)))),
            _lazy(4, () => TabEntrance(active: tab == 4, child: InfoScreen(app: app))),
          ]),
          bottomNavigationBar: app.navigating
              ? null
              : Column(mainAxisSize: MainAxisSize.min, children: [
                  if (app.skin == 'chamak') const ChamakStrip(height: 8)
                  else if (app.skin != 'standard') Container(height: 2, color: skinPalette(app.skin, Theme.of(context).brightness).accent),
                  NavigationBar(
                  selectedIndex: tab,
                  onDestinationSelected: _open,
                  destinations: [
                    NavigationDestination(icon: const Icon(Icons.map_outlined), label: tr(lang, 'navMap')),
                    NavigationDestination(icon: const Icon(Icons.warning_amber), label: tr(lang, 'navRoad')),
                    NavigationDestination(icon: const Icon(Icons.directions_bus_outlined), label: tr(lang, 'navTransit')),
                    NavigationDestination(icon: const Icon(Icons.local_hospital_outlined), label: tr(lang, 'navSos')),
                    NavigationDestination(icon: const Icon(Icons.info_outline), label: tr(lang, 'navInfo')),
                  ],
                  ),
                ]),
        );
      },
    );
  }
}

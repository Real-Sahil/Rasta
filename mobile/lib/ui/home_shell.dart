import 'package:material_ui/material_ui.dart';

import '../l10n.dart';
import '../services/reports_api.dart';
import '../state/app_state.dart';
import 'chamak.dart';
import 'emergency_screen.dart';
import 'incidents_screen.dart';
import 'info_screen.dart';
import 'map_screen.dart';
import 'transit_screen.dart';

/// Five tabs. The bar hides while navigating so the HUD keeps the whole screen. IndexedStack keeps the map alive.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.app, required this.api});
  final AppState app;
  final ReportsApi api;
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final app = widget.app;
    final lang = app.lang;
    return ListenableBuilder(
      listenable: app,
      builder: (context, _) {
        final tab = app.navigating ? 0 : _tab;
        return Scaffold(
          body: IndexedStack(index: tab, children: [
            MapScreen(app: app),
            IncidentsScreen(app: app, api: widget.api, active: tab == 1),
            TransitScreen(app: app, api: widget.api, active: tab == 2, onRouteTo: () => setState(() => _tab = 0)),
            EmergencyScreen(app: app, onRouteTo: () => setState(() => _tab = 0)),
            InfoScreen(app: app),
          ]),
          bottomNavigationBar: app.navigating
              ? null
              : Column(mainAxisSize: MainAxisSize.min, children: [
                  if (app.skin == 'chamak') const ChamakStrip(height: 8)
                  else if (app.skin != 'standard') Container(height: 2, color: skinPalette(app.skin, Theme.of(context).brightness).accent),
                  NavigationBar(
                  selectedIndex: tab,
                  onDestinationSelected: (i) => setState(() => _tab = i),
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

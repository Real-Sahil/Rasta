import 'package:buraq_mobile/main.dart';
import 'package:buraq_mobile/state/app_state.dart';
import 'package:buraq_mobile/state/app_watch.dart';
import 'package:buraq_mobile/ui/emergency_screen.dart';
import 'package:buraq_mobile/ui/incidents_screen.dart';
import 'package:buraq_mobile/ui/info_screen.dart';
import 'package:buraq_mobile/ui/transit_screen.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Low-memory phones: tabs are built only when first opened, and a change the watcher doesn't care about (like a GPS
// fix while driving) doesn't rebuild it.
void main() {
  setUp(() => SharedPreferences.setMockInitialValues({'safetyAck': true}));

  testWidgets('AppWatch rebuilds only when the selected value changes', (t) async {
    final app = AppState();
    var builds = 0;
    await t.pumpWidget(AppWatch(
      app: app,
      select: (a) => (a.lang, a.skin),
      builder: (context, _) {
        builds++;
        return const SizedBox.shrink();
      },
    ));
    expect(builds, 1);
    app.toggleMute(); // notifies, but neither language nor skin changed
    await t.pump();
    expect(builds, 1);
    app.setLang('ur');
    await t.pump();
    expect(builds, 2);
  });

  testWidgets('tabs are built the first time they are opened, then kept', (t) async {
    t.view.physicalSize = const Size(400, 800);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    await t.pumpWidget(const BuraqApp());
    await t.pump(const Duration(milliseconds: 500));
    expect(find.byType(InfoScreen, skipOffstage: false), findsNothing);
    expect(find.byType(IncidentsScreen, skipOffstage: false), findsNothing);
    expect(find.byType(TransitScreen, skipOffstage: false), findsNothing);
    expect(find.byType(EmergencyScreen, skipOffstage: false), findsNothing);

    await t.tap(find.byIcon(Icons.info_outline));
    await t.pump(const Duration(milliseconds: 500));
    expect(find.byType(InfoScreen), findsOneWidget);
    expect(find.byType(EmergencyScreen, skipOffstage: false), findsNothing);

    await t.tap(find.byIcon(Icons.map_outlined));
    await t.pump(const Duration(milliseconds: 500));
    expect(find.byType(InfoScreen, skipOffstage: false), findsOneWidget, reason: 'an opened tab is kept, not rebuilt from scratch');
    expect(t.takeException(), isNull);
  });
}

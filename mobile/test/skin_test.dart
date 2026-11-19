import 'package:buraq_mobile/core/geo.dart';
import 'package:buraq_mobile/core/transit.dart';
import 'package:buraq_mobile/l10n.dart';
import 'package:buraq_mobile/state/app_state.dart';
import 'package:buraq_mobile/ui/chamak.dart';
import 'package:buraq_mobile/ui/line_diagram.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('skin and theme default to off/system and persist', () async {
    SharedPreferences.setMockInitialValues({});
    final a = AppState();
    expect(a.chamak, isFalse);
    expect(a.themeMode, ThemeMode.system);
    await a.setChamak(true);
    await a.setThemeMode(ThemeMode.dark);
    final p = await SharedPreferences.getInstance();
    expect(p.getBool('skinChamak'), isTrue);
    expect(p.getString('themeMode'), 'dark');
  });

  test('new strings exist in en/ur/pa', () {
    for (final k in ['themeLabel', 'themeAuto', 'themeLight', 'themeDark', 'skinLabel', 'skinNote', 'diagList', 'diagDiagram', 'diagNote', 'diagBoard', 'diagAlight']) {
      final en = tr('en', k);
      expect(en, isNot(k));
      for (final l in ['ur', 'pa']) {
        expect(tr(l, k), isNot(k), reason: '$k/$l');
      }
    }
  });

  test('chamak theme keeps contrast: white text on red primary', () {
    for (final b in [Brightness.light, Brightness.dark]) {
      final t = buildTheme(chamak: true, brightness: b);
      expect(t.colorScheme.primary, kChamakRed);
      expect(t.colorScheme.onPrimary, Colors.white);
      expect(t.brightness, b);
    }
  });

  testWidgets('diagram marks board and get-off stations', (tester) async {
    final st = [for (var i = 0; i < 5; i++) Station(id: 's$i', name: 'S$i', code: 'C$i', line: 'x', point: LatLng(31.0 + i / 100, 74.0))];
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: SingleChildScrollView(child: LineDiagram(stations: st, color: Colors.orange, lang: 'en', fromId: 's1', toId: 's3', boardLabel: 'Board', alightLabel: 'Get off', note: 'Schematic, not to scale.'))),
    ));
    expect(find.text('Board'), findsOneWidget);
    expect(find.text('Get off'), findsOneWidget);
    expect(find.text('S0'), findsOneWidget);
    expect(find.text('Schematic, not to scale.'), findsOneWidget);
  });
}

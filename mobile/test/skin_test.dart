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
    expect(a.skin, 'standard');
    expect(a.themeMode, ThemeMode.system);
    await a.setSkin('luce');
    await a.setThemeMode(ThemeMode.dark);
    final p = await SharedPreferences.getInstance();
    expect(p.getString('skin'), 'luce');
    expect(p.getString('themeMode'), 'dark');
  });

  test('new strings exist in en/ur/pa', () {
    for (final k in ['themeLabel', 'themeAuto', 'themeLight', 'themeDark', 'skinLabel', 'diagList', 'diagDiagram', 'diagNote', 'diagBoard', 'diagAlight']) {
      final en = tr('en', k);
      expect(en, isNot(k));
      for (final l in ['ur', 'pa']) {
        expect(tr(l, k), isNot(k), reason: '$k/$l');
      }
    }
  });

  test('every skin keeps readable text in light and dark', () {
    double lum(Color c) => c.computeLuminance();
    double ratio(Color a, Color b) {
      final x = lum(a), y = lum(b);
      return (x > y ? x + 0.05 : y + 0.05) / (x > y ? y + 0.05 : x + 0.05);
    }
    for (final k in kSkins.where((k) => k != 'standard')) {
      for (final b in [Brightness.light, Brightness.dark]) {
        final p = skinPalette(k, b);
        expect(ratio(p.ink, p.paper), greaterThan(7), reason: '$k $b body text');
        expect(ratio(p.accent, p.card), greaterThan(3), reason: '$k $b accent on card');
        expect(ratio(p.onBadge, p.badge), greaterThan(3), reason: '$k $b icon on badge');
        expect(buildTheme(skin: k, brightness: b).brightness, b);
      }
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

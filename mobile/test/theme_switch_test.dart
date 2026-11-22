import 'package:buraq_mobile/main.dart';
import 'package:buraq_mobile/ui/chamak.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Switching the look once showed the red error screen: chips and buttons blend their text style when the theme
// changes, and the skinned themes used a different kind of style from the standard one. Every skin, both ways, both
// brightnesses, and every tap must actually find its button (nothing is skipped).
void main() {
  Future<void> tapVisible(WidgetTester t, Finder f) async {
    expect(f, findsWidgets);
    await t.ensureVisible(f.first);
    await t.pump();
    await t.tap(f.first);
    for (var i = 0; i < 8; i++) {
      await t.pump(const Duration(milliseconds: 50)); // let the 200 ms style blends run
    }
  }

  testWidgets('switching light/dark and every skin on the Info tab does not throw', (t) async {
    SharedPreferences.setMockInitialValues({'safetyAck': true});
    t.view.physicalSize = const Size(400, 800);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    await t.pumpWidget(const BuraqApp());
    await t.pump(const Duration(milliseconds: 500));
    await t.tap(find.byIcon(Icons.info_outline));
    await t.pump(const Duration(milliseconds: 500));
    for (final mode in ['Light', 'Dark', 'Auto']) {
      await tapVisible(t, find.text(mode));
      expect(t.takeException(), isNull, reason: mode);
      for (final k in [...kSkins.skip(1), 'standard']) {
        // Standard, then the skin, then back: each change in both directions.
        for (final name in [kSkinNames[k]!.isEmpty ? 'Standard' : kSkinNames[k]!, 'Standard']) {
          await tapVisible(t, find.widgetWithText(ChoiceChip, name));
          expect(t.takeException(), isNull, reason: '$mode / $name');
        }
      }
    }
  });
}

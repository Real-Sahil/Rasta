import 'package:buraq_mobile/main.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('switching light/dark and skins on the Info tab does not throw', (t) async {
    SharedPreferences.setMockInitialValues({'safetyAck': true});
    t.view.physicalSize = const Size(400, 800);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    await t.pumpWidget(const BuraqApp());
    await t.pump(const Duration(milliseconds: 500));
    await t.tap(find.byIcon(Icons.info_outline));
    await t.pump(const Duration(milliseconds: 500));
    for (final label in ['Light', 'Dark', 'Auto', 'Dark']) {
      await t.tap(find.text(label).first);
      await t.pump(const Duration(milliseconds: 100));
      await t.pump(const Duration(milliseconds: 500));
    }
    for (final label in ['Luce', 'Chamak', 'Nastaliq', 'Standard']) {
      final f = find.text(label);
      if (f.evaluate().isEmpty) continue;
      await t.tap(f.first);
      await t.pump(const Duration(milliseconds: 100));
      await t.pump(const Duration(milliseconds: 500));
    }
    expect(t.takeException(), isNull);
  });
}

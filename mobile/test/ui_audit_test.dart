import 'package:buraq_mobile/main.dart';
import 'package:buraq_mobile/state/app_state.dart';
import 'package:buraq_mobile/ui/incidents_screen.dart' show ageLabel, credLabel;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('first-run notice can be accepted on a small phone with large text', (t) async {
    SharedPreferences.setMockInitialValues({});
    t.view.physicalSize = const Size(360, 640);
    t.view.devicePixelRatio = 1;
    t.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(t.view.reset);
    addTearDown(t.platformDispatcher.clearTextScaleFactorTestValue);
    final app = AppState();
    await t.pumpWidget(MaterialApp(home: SafetyGate(app: app, child: const Text('inside'))));
    await t.pumpAndSettle(); // an overflow would fail the test here
    final ok = find.byType(FilledButton);
    await t.scrollUntilVisible(ok, 100);
    await t.tap(ok);
    await t.pump();
    expect(find.text('inside'), findsOneWidget);
  });

  test('report age reads in hours past the first hour', () {
    expect(ageLabel('en', 0), 'Just now');
    expect(ageLabel('en', 12), '12 min ago');
    expect(ageLabel('en', 200), '3 h 20 min ago');
  });

  test('credibility text agrees with the number of confirmations', () {
    expect(credLabel('en', 50, 0), 'Credibility 50%. No confirmations yet. Unofficial.');
    expect(credLabel('en', 55, 1), 'Credibility 55% from 1 confirmation. Unofficial.');
    expect(credLabel('en', 60, 2), 'Credibility 60% from 2 confirmations. Unofficial.');
  });
}

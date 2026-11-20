import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:buraq_mobile/ui/motion.dart';

void main() {
  Widget host(bool reduce, Widget child) => MediaQuery(data: MediaQueryData(disableAnimations: reduce), child: Directionality(textDirection: TextDirection.ltr, child: child));

  testWidgets('"remove animations" makes every transition instant', (t) async {
    late Duration d;
    await t.pumpWidget(host(true, Builder(builder: (c) { d = motionMs(c, 240); return const SizedBox(); })));
    expect(d, Duration.zero);
    await t.pumpWidget(host(false, Builder(builder: (c) { d = motionMs(c, 240); return const SizedBox(); })));
    expect(d, const Duration(milliseconds: 240));
  });

  testWidgets('Entrance ends fully visible and in place', (t) async {
    await t.pumpWidget(host(false, const Entrance(child: Text('x'))));
    expect(t.widget<Opacity>(find.byType(Opacity)).opacity, lessThan(1));
    await t.pumpAndSettle();
    expect(t.widget<Opacity>(find.byType(Opacity)).opacity, 1);
  });

  testWidgets('SlideSwitcher leaves only the new child once settled', (t) async {
    await t.pumpWidget(host(false, const SlideSwitcher(child: Text('a', key: ValueKey('a')))));
    await t.pumpWidget(host(false, const SlideSwitcher(child: Text('b', key: ValueKey('b')))));
    expect(find.text('a'), findsOneWidget); // fading out
    await t.pumpAndSettle();
    expect(find.text('a'), findsNothing);
    expect(find.text('b'), findsOneWidget);
  });
}

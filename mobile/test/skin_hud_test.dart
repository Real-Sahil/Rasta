import 'package:buraq_mobile/core/skin_hud.dart';
import 'package:buraq_mobile/ui/chamak.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

void main() {
  test('dial is empty far away, full at the turn, and clamps', () {
    expect(dialProgress(800), 0);
    expect(dialProgress(500), 0);
    expect(dialProgress(250), closeTo(0.5, 1e-9));
    expect(dialProgress(0), 1);
    expect(dialProgress(-5), 1);
  });

  test('poster word uses the draft Urdu/Punjabi phrases, English otherwise', () {
    expect(posterWord('turn-left', 'ur'), 'بائیں مڑیں');
    expect(posterWord('turn-right', 'pa'), 'سجے مڑو');
    expect(posterWord('turn-left', 'en'), 'Turn left');
    expect(posterWord('roundabout', 'en'), 'Enter the roundabout');
  });

  testWidgets('Luce dial paints and shows its child', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: LuceDial(progress: 0.4, lit: Colors.orange, dim: Colors.grey, child: Icon(Icons.turn_left)))));
    expect(find.byIcon(Icons.turn_left), findsOneWidget);
  });
}

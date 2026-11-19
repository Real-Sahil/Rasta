import 'package:buraq_mobile/core/geo.dart';
import 'package:buraq_mobile/core/navigation.dart';
import 'package:buraq_mobile/services/gps_service.dart';
import 'package:buraq_mobile/services/nearby_service.dart';
import 'package:buraq_mobile/services/speech_service.dart';
import 'package:buraq_mobile/state/app_state.dart';
import 'package:buraq_mobile/ui/emergency_screen.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:material_ui/material_ui.dart';

class _QuietSpeech extends SpeechService {
  @override
  Future<void> init() async {}
  @override
  Future<void> stop() async {}
}

const _multan = '{"items":[{"id":"osm_way_42","kind":"hospital","name":"Nishtar Hospital","nameUrdu":null,"lat":30.2,"lng":71.47,"address":"Nishtar Road, Multan","phone":null,"open24h":true,"emergency":true}]}';

void main() {
  setUp(() => rootBundle.clear()); // a cached asset future from a previous test's fake-async zone never completes
  test('asks our API with a point rounded to ~1 km and caches per cell', () async {
    final seen = <Uri>[];
    final s = NearbyService(api: 'https://example.test/api', client: MockClient((r) async { seen.add(r.url); return http.Response(_multan, 200); }));
    final a = await s.nearby('hospital', const LatLng(30.19841, 71.46874));
    expect(a!.single.name, 'Nishtar Hospital');
    expect(seen.single.queryParameters, {'op': 'nearby', 'kind': 'hospital', 'near': '30.20,71.47'});
    await s.nearby('hospital', const LatLng(30.1990, 71.4690)); // same cell
    expect(seen, hasLength(1));
  });
  test('returns null (fall back) when the server cannot answer', () async {
    final s = NearbyService(api: 'https://example.test/api', client: MockClient((_) async => http.Response('', 503)));
    expect(await s.nearby('fuel', const LatLng(30.2, 71.47)), isNull);
  });

  Future<void> pump(WidgetTester t, String body, int status) async {
    t.view.physicalSize = const Size(1000, 6000); // tall enough that the whole list is built
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    final app = AppState(gps: GpsService(), speech: _QuietSpeech());
    app.onFix(Fix(lat: 30.1984, lng: 71.4687, accuracy: 10)); // Multan
    final nearby = NearbyService(api: 'https://example.test/api', client: MockClient((_) async => http.Response(body, status)));
    await t.pumpWidget(MaterialApp(home: EmergencyScreen(app: app, nearby: nearby)));
    // the bundled asset and the mocked request are real async work: let them finish outside fake time
    for (var i = 0; i < 200 && find.byType(CircularProgressIndicator).evaluate().isNotEmpty; i++) {
      await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
      await t.pump();
    }
  }

  testWidgets('outside Lahore shows live places near the fix, credited to Geoapify', (t) async {
    await pump(t, _multan, 200);
    expect(find.text('Nishtar Hospital'), findsOneWidget);
    expect(find.textContaining('via Geoapify'), findsOneWidget);
    expect(find.textContaining('Lahore area only'), findsNothing);
  });
  testWidgets('when the server fails it says so and shows the bundled Lahore list', (t) async {
    await pump(t, '', 503);
    expect(find.textContaining('Could not load places near you'), findsOneWidget);
    expect(find.textContaining('Lahore area only'), findsOneWidget);
    expect(find.textContaining('via Geoapify'), findsNothing);
  });
}

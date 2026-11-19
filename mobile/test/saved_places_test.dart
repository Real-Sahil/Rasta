import 'package:buraq_mobile/core/coverage.dart';
import 'package:buraq_mobile/core/geo.dart';
import 'package:buraq_mobile/core/navigation.dart';
import 'package:buraq_mobile/core/saved_places.dart';
import 'package:buraq_mobile/services/gps_service.dart';
import 'package:buraq_mobile/services/search_service.dart';
import 'package:buraq_mobile/services/speech_service.dart';
import 'package:buraq_mobile/state/app_state.dart';
import 'package:buraq_mobile/ui/map_screen.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _QuietSpeech extends SpeechService {
  @override
  Future<void> init() async {}
  @override
  Future<void> stop() async {}
}

Place pl(String id, double lat, double lng) => Place(id: id, name: 'P$id', detail: 'd', point: LatLng(lat, lng));

void main() {
  group('inPakistan', () {
    const inside = {
      'Lahore': LatLng(31.5204, 74.3587), 'Karachi': LatLng(24.8607, 67.0011), 'Islamabad': LatLng(33.6844, 73.0479),
      'Peshawar': LatLng(34.0151, 71.5249), 'Quetta': LatLng(30.1798, 66.9750), 'Gwadar': LatLng(25.1264, 62.3225),
      'Gilgit': LatLng(35.9208, 74.3089), 'Skardu': LatLng(35.2971, 75.6333), 'Chaman': LatLng(30.9210, 66.4597),
      'Sialkot': LatLng(32.4945, 74.5229), 'Muzaffarabad': LatLng(34.3700, 73.4711), 'Rahim Yar Khan': LatLng(28.4202, 70.2952),
      'Mirpur Khas': LatLng(25.5251, 69.0159), 'Zhob': LatLng(31.3417, 69.4486), 'Taftan': LatLng(28.9636, 61.5958), 'Jiwani': LatLng(25.0480, 61.7440),
      'Chitral': LatLng(35.8518, 71.7864), 'Sost': LatLng(36.6930, 74.8170), 'Kasur': LatLng(31.1187, 74.4502),
    };
    const outside = {
      'Derby': LatLng(52.9225, -1.4746), 'Delhi': LatLng(28.6139, 77.2090), 'Kabul': LatLng(34.5553, 69.2075),
      'Kandahar': LatLng(31.6289, 65.7372), 'Jaisalmer': LatLng(26.9157, 70.9083), 'Dubai': LatLng(25.2048, 55.2708),
    };
    inside.forEach((n, p) => test('$n is inside', () => expect(inPakistan(p), isTrue)));
    outside.forEach((n, p) => test('$n is outside', () => expect(inPakistan(p), isFalse)));
    test('no fix means no notice', () => expect(outsidePakistan(null), isFalse));
  });

  group('SavedPlaces', () {
    test('recent list is newest first, de-duplicated and capped', () {
      var s = const SavedPlaces();
      for (var i = 0; i < 8; i++) {
        s = s.remember(pl('$i', 31.5 + i * 0.01, 74.3));
      }
      s = s.remember(pl('x', 31.5 + 6 * 0.01 + 0.0001, 74.3)); // ~11 m from #6: the same spot
      expect(s.recent.length, maxRecent);
      expect(s.recent.first.id, 'x');
      expect(s.recent.where((p) => p.id == '6'), isEmpty);
    });
    test('"my location" is never remembered', () => expect(const SavedPlaces().remember(pl('me', 31.5, 74.3)).recent, isEmpty));
    test('round-trips through storage; corrupt data gives an empty list', () {
      final s = const SavedPlaces().remember(pl('a', 31.5, 74.3)).withHome(pl('h', 31.4, 74.2));
      final back = SavedPlaces.decode(s.encode());
      expect(back.home!.id, 'h');
      expect(back.recent.single.point, const LatLng(31.5, 74.3));
      expect(SavedPlaces.decode('{not json').isEmpty, isTrue);
      expect(SavedPlaces.decode('{"recent":[{"id":"z","name":"","lat":1,"lng":2}]}').recent, isEmpty);
    });
    test('clearHistory keeps Home and Work', () {
      final s = const SavedPlaces().remember(pl('a', 31.5, 74.3)).withWork(pl('w', 31.4, 74.2)).clearHistory();
      expect(s.recent, isEmpty);
      expect(s.work, isNotNull);
    });
  });

  group('AppState persistence', () {
    test('language, mute and places survive a restart', () async {
      SharedPreferences.setMockInitialValues({});
      final a = AppState(gps: GpsService(), speech: _QuietSpeech());
      a.setLang('ur');
      a.toggleMute();
      a.setHome(pl('h', 31.4, 74.2));
      await Future<void>.delayed(Duration.zero);
      final b = AppState(gps: GpsService(), speech: _QuietSpeech());
      await b.loadPrefs();
      expect(b.lang, 'ur');
      expect(b.muted, isTrue);
      expect(b.places.home!.id, 'h');
    });
  });

  group('search panel', () {
    Future<AppState> pump(WidgetTester t, LatLng? at) async {
      final app = AppState(gps: GpsService(), speech: _QuietSpeech());
      if (at != null) app.onFix(Fix(lat: at.lat, lng: at.lng, accuracy: 10));
      await t.pumpWidget(MaterialApp(home: Scaffold(body: ListenableBuilder(listenable: app, builder: (_, _) => SearchPanel(app: app)))));
      return app;
    }

    testWidgets('outside-Pakistan notice shows for a Derby fix', (t) async {
      await pump(t, const LatLng(52.9225, -1.4746));
      expect(find.textContaining('Buraq covers Pakistan only'), findsOneWidget);
    });
    testWidgets('no notice in Lahore or without a fix', (t) async {
      await pump(t, const LatLng(31.5204, 74.3587));
      expect(find.textContaining('Buraq covers Pakistan only'), findsNothing);
      await pump(t, null);
      expect(find.textContaining('Buraq covers Pakistan only'), findsNothing);
    });
    testWidgets('saved places appear when the empty box is focused', (t) async {
      SharedPreferences.setMockInitialValues({});
      final app = await pump(t, null);
      app.setHome(pl('h', 31.4, 74.2));
      await t.pump();
      expect(find.text('Home'), findsNothing);
      await t.tap(find.byType(TextField).first);
      await t.pump();
      expect(find.text('Home'), findsOneWidget);
    });
  });
}

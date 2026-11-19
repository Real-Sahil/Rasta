import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

import 'package:buraq_mobile/core/conditions.dart';
import 'package:buraq_mobile/core/emergency.dart';
import 'package:buraq_mobile/core/fares.dart';
import 'package:buraq_mobile/core/geo.dart';
import 'package:buraq_mobile/core/places.dart';
import 'package:buraq_mobile/l10n.dart';
import 'package:buraq_mobile/l10n_more.dart';
import 'package:buraq_mobile/services/conditions_service.dart';

void main() {
  test('bundled OSM assets are identical to the web app source', () {
    for (final f in ['hospitals', 'fuel']) {
      expect(File('assets/osm/$f.json').readAsStringSync(), File('../src/data/osm/$f.json').readAsStringSync(), reason: 'run node mobile/tool/sync_osm.mjs');
    }
  });

  test('places parse, drop malformed rows and keep unknowns null', () {
    final f = parsePoiFile(File('assets/osm/hospitals.json').readAsStringSync());
    expect(f.items.length, greaterThan(100));
    expect(f.fetchedAt, matches(RegExp(r'^\d{4}-\d\d-\d\d$')));
    final p = parsePoiFile(jsonEncode({'meta': {}, 'items': [{'id': 'a', 'name': 'X', 'lat': 1, 'lng': 2, 'phone': ' '}, {'id': 'b'}]}));
    expect(p.items.length, 1);
    expect(p.items.first.phone, isNull);
    expect(p.items.first.open24h, isNull);
  });

  test('nearest sorts by distance with a fix and alphabetically without', () {
    final a = Poi.fromJson({'id': 'a', 'name': 'Zed', 'lat': 31.52, 'lng': 74.35})!;
    final b = Poi.fromJson({'id': 'b', 'name': 'Alpha', 'lat': 31.9, 'lng': 74.9})!;
    expect(nearest([b, a], const LatLng(31.52, 74.35)).map((e) => e.poi.id), ['a', 'b']);
    expect(nearest([a, b], null).map((e) => e.poi.id), ['b', 'a']);
    expect(nearest([a, b], null).first.distanceM, isNull);
  });

  test('coverage warning only when the user is clearly outside the Lahore data', () {
    expect(outsideCoverage(null), isFalse);
    expect(outsideCoverage(const LatLng(31.55, 74.34)), isFalse);
    expect(outsideCoverage(const LatLng(24.86, 67.0)), isTrue); // Karachi
  });

  test('SOS text carries the real coordinates and a map link; WhatsApp uri encodes it', () {
    final t = sosText(const LatLng(31.52041, 74.35871), 'en');
    expect(t, contains('31.52041, 74.35871'));
    expect(t, contains('https://www.google.com/maps?q=31.52041,74.35871'));
    expect(sosText(const LatLng(1, 2), 'ur'), contains('1122'));
    expect(whatsappUri(t).host, 'wa.me');
    expect(whatsappUri(t).queryParameters['text'], t);
    expect(emergencyContacts.map((c) => c.number), ['1122', '15', '130', '115']);
  });

  test('AQI bands, weather codes and waterlogging thresholds', () {
    expect([0, 50, 51, 100, 101, 150, 151, 200, 201, 300, 301].map(aqiBand), ['good', 'good', 'moderate', 'moderate', 'sensitive', 'sensitive', 'unhealthy', 'unhealthy', 'veryUnhealthy', 'veryUnhealthy', 'hazardous']);
    expect([0, 2, 45, 53, 63, 81, 96, 10].map(conditionKey), ['clear', 'partlyCloudy', 'fog', 'drizzle', 'rain', 'showers', 'thunderstorm', 'cloudy']);
    expect([0.0, 2.4, 2.5, 7.4, 7.5].map(waterloggingRisk), ['low', 'low', 'moderate', 'moderate', 'high']);
  });

  test('nearest city needs a real fix within 80 km', () {
    expect(nearestCity(null), isNull);
    expect(nearestCity(const LatLng(31.55, 74.34)), 'lahore');
    expect(nearestCity(const LatLng(33.6, 73.05)), anyOf('islamabad', 'rawalpindi'));
    expect(nearestCity(const LatLng(34.0, 71.56)), 'peshawar');
    expect(nearestCity(const LatLng(28.5, 64.5)), isNull); // central Balochistan: no listed city close, use "my location"
    expect(roundedForWeather(const LatLng(28.5432, 64.4567)), const LatLng(28.5, 64.5)); // ~10 km before it leaves the phone
  });

  test('conditions: each half fails on its own and bad data is never turned into numbers', () async {
    final ok = await fetchConditions('lahore', fetch: (u) async {
      if (u.host.startsWith('air-quality')) return http.Response(jsonEncode({'current': {'us_aqi': 162.4, 'pm2_5': 71.6}}), 200);
      return http.Response(jsonEncode({'current': {'temperature_2m': 24.6, 'precipitation': 3.0, 'weather_code': 61}}), 200);
    });
    expect([ok.tempC, ok.condition, ok.rainMm, ok.aqi, ok.pm25], [25, 'rain', 3.0, 162, 72]);

    final half = await fetchConditions('lahore', fetch: (u) async => u.host.startsWith('air-quality') ? http.Response('nope', 500) : http.Response(jsonEncode({'current': {'temperature_2m': 10}}), 200));
    expect(half.tempC, 10);
    expect(half.aqi, isNull);

    final none = await fetchConditions('lahore', fetch: (u) async => throw Exception('offline'));
    expect(none.isEmpty, isTrue);
    final junk = await fetchConditions('lahore', fetch: (u) async => http.Response(jsonEncode({'current': {'temperature_2m': 'hot', 'us_aqi': null}}), 200));
    expect(junk.isEmpty, isTrue);
  });

  test('requests go to Open-Meteo with the city centre', () {
    final u = weatherUri(cityCentres['karachi']!);
    expect(u.host, 'api.open-meteo.com');
    expect(u.queryParameters['latitude'], '24.8607');
    expect(aqiUri(cityCentres['lahore']!).host, 'air-quality-api.open-meteo.com');
  });

  test('fares match the web calculator for a 10 km / 20 min trip', () {
    final o = {for (final x in compareModes(distanceKm: 10, durationMinutes: 20)) x.mode: x};
    expect([o['orangeline']!.costPkr, o['orangeline']!.minutes], [30, 22]);
    expect([o['metrobus']!.costPkr, o['metrobus']!.minutes], [30, 22]);
    expect(o['motorbike']!.costPkr, 55);
    expect(o['car']!.costPkr, 196);
    expect(o['rickshaw']!.costPkr, 320);
    expect(o['rideHail']!.costPkr, 520);
    expect(o['walking']!.minutes, 120);
    expect(o.values.where((x) => x.cheapest).map((x) => x.mode), ['orangeline']);
    expect(o.values.where((x) => x.fastest).map((x) => x.mode), ['motorbike']);
  });

  test('student concession halves metro fares; short and tiny trips are floored', () {
    final o = {for (final x in compareModes(distanceKm: 10, durationMinutes: 20, student: true)) x.mode: x};
    expect([o['orangeline']!.costPkr, o['metrobus']!.costPkr], [15, 15]);
    final tiny = {for (final x in compareModes(distanceKm: 0.1, durationMinutes: 1)) x.mode: x};
    expect(tiny['rideHail']!.costPkr, 180);
    expect(tiny['car']!.costPkr, 80);
    expect(tiny['walking']!.costPkr, 0);
  });

  test('outside Lahore there is no Metrobus or Orange Line', () {
    final m = compareModes(distanceKm: 10, durationMinutes: 20, lahore: false).map((o) => o.mode);
    expect(m, isNot(contains('metrobus')));
    expect(m, isNot(contains('orangeline')));
    expect(inLahoreArea(const LatLng(31.55, 74.34)), isTrue);
    expect(inLahoreArea(const LatLng(24.86, 67.0)), isFalse);
  });

  test('stage 3 strings: same keys in en/ur/pa, placeholders kept, every bucket key has a label', () {
    final en = moreStrings['en']!;
    for (final l in ['ur', 'pa']) {
      expect(moreStrings[l]!.keys.toSet(), en.keys.toSet(), reason: l);
      for (final k in en.keys) {
        for (final ph in RegExp(r'\{\w+\}').allMatches(en[k]!).map((m) => m.group(0)!)) {
          expect(moreStrings[l]![k]!.contains(ph), isTrue, reason: '$l.$k lost $ph');
        }
      }
    }
    String cap(String k) => k[0].toUpperCase() + k.substring(1);
    for (final l in ['en', 'ur', 'pa']) {
      for (final b in ['good', 'moderate', 'sensitive', 'unhealthy', 'veryUnhealthy', 'hazardous']) { expect(tr(l, 'aqi${cap(b)}'), isNot('aqi${cap(b)}')); }
      for (final c in ['clear', 'partlyCloudy', 'fog', 'drizzle', 'rain', 'showers', 'thunderstorm', 'cloudy']) { expect(tr(l, 'wx${cap(c)}'), isNot('wx${cap(c)}')); }
      for (final r in ['low', 'moderate', 'high']) { expect(tr(l, 'risk${cap(r)}'), isNot('risk${cap(r)}')); }
      for (final m in ['orangeline', 'metrobus', 'motorbike', 'car', 'rickshaw', 'rideHail', 'walking']) { expect(tr(l, 'fm${cap(m)}'), isNot('fm${cap(m)}')); }
      for (final c in cityCentres.keys) { expect(tr(l, 'city${cap(c)}'), isNot('city${cap(c)}')); }
    }
    expect(tr('en', 'legalPrivacy2'), contains('Open-Meteo'));
    expect(tr('pa', 'legalPrivacy2'), contains('Open-Meteo'));
  });
}

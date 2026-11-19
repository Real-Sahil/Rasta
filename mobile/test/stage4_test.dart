import 'dart:io';

import 'package:buraq_mobile/core/flood.dart';
import 'package:buraq_mobile/core/transit.dart';
import 'package:buraq_mobile/l10n.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('bundled transit and flood assets are identical to the web app source', () {
    for (final f in ['metrobus', 'orangeline']) {
      expect(File('assets/osm/$f.json').readAsStringSync(), File('../src/data/osm/$f.json').readAsStringSync(), reason: 'run node mobile/tool/sync_osm.mjs');
    }
    expect(File('assets/flood/lahore.json').readAsStringSync(), File('../src/data/flood/lahore.json').readAsStringSync(), reason: 'run node mobile/tool/sync_osm.mjs');
  });

  test('stations parse in line order and keep unknown Urdu names null', () {
    final mb = parseStations(File('assets/osm/metrobus.json').readAsStringSync());
    expect(mb.length, 27);
    expect(mb.first.code, 'MB01');
    expect(mb.first.nameUrdu, isNull);
    expect(mb.first.label('ur'), mb.first.name);
    final ol = parseStations(File('assets/osm/orangeline.json').readAsStringSync());
    expect(ol.length, 26);
    expect(ol.first.label('ur'), 'ڈیرہ گجراں');
    expect(parseStations('{"items":[{"id":"x","name":"A","lat":1,"lng":2},{"id":"y"}]}').length, 1);
    expect(parseStations('not an object'.replaceAll('not an object', '[]')), isEmpty);
  });

  test('fares follow the web calculator bands and halve for students', () {
    expect(transitFare('orangeline', 0), 0);
    expect(transitFare('orangeline', 4), 20);
    expect(transitFare('orangeline', 5), 25);
    expect(transitFare('orangeline', 12), 30);
    expect(transitFare('orangeline', 16), 35);
    expect(transitFare('orangeline', 17), 40);
    expect(transitFare('metrobus', 9), 30);
    expect(transitFare('metrobus', 9, student: true), 15);
    expect(transitFare('orangeline', 5, student: true), 13);
    expect(transitMinutes('metrobus', 1), 5);
    expect(transitMinutes('orangeline', 10), 21);
  });

  test('flood events parse into GeoJSON and bad data gives none', () {
    final ev = parseFlood(File('assets/flood/lahore.json').readAsStringSync());
    expect(ev.length, 2);
    expect(floodGeoJson(ev.first)['geometry']['type'], 'MultiPolygon');
    expect(parseFlood('{"events":[{"id":"a","polygons":[]},{"polygons":[[]]}]}'), isEmpty);
  });

  test('transit and flood strings exist in every language, and Urdu differs from English', () {
    const keys = ['navTransit', 'trTabStations', 'trTapHint', 'trFareResult', 'trEstimate', 'floodLayer', 'floodNote', 'floodCredit', 'floodEvent1', 'floodEvent2'];
    for (final k in keys) {
      for (final l in ['en', 'ur', 'pa']) {
        expect(tr(l, k), isNot(k), reason: '$l $k');
      }
      expect(tr('ur', k), isNot(tr('en', k)), reason: 'ur $k');
    }
    expect(tr('ur', 'floodCredit'), contains('CC BY-SA'));
  });
}

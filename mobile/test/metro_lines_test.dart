import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:buraq_mobile/core/transit.dart';

void main() {
  test('parseLines keeps named stations in order, numbers them and reads the OSM colour', () {
    final l = parseLines(jsonEncode({
      'meta': {},
      'items': [
        {
          'id': 'multan_metrobus', 'city': 'multan', 'name': 'Multan Metrobus', 'nameUrdu': 'ملتان میٹرو', 'colour': '#e11d48',
          'stations': [
            {'id': 'a', 'name': 'Bahauddin Zakariya University', 'lat': 30.26, 'lng': 71.51},
            {'id': 'b', 'name': null, 'lat': 30.25, 'lng': 71.5},
            {'id': 'c', 'name': 'Kumharanwala', 'lat': 30.2, 'lng': 71.47},
          ],
        },
        {'id': 'one_stop', 'city': 'karachi', 'name': 'X', 'stations': [{'id': 'z', 'name': 'Only', 'lat': 24.9, 'lng': 67.0}]},
        {'id': 'bad'},
      ],
    }));
    expect(l.length, 1);
    expect(l.first.stations.map((s) => s.code), ['1', '2']);
    expect(l.first.stations.map((s) => s.line).toSet(), {'multan_metrobus'});
    expect(l.first.colour, 0xFFE11D48);
    expect(l.first.label('ur'), 'ملتان میٹرو');
    expect(l.first.label('en'), 'Multan Metrobus');
    expect(parseLines('{}'), isEmpty);
  });

  test('Islamabad and Rawalpindi share one metro area', () {
    expect(metroCityFor('islamabad'), 'islamabad_rawalpindi');
    expect(metroCityFor('rawalpindi'), 'islamabad_rawalpindi');
    expect(metroCityFor('multan'), 'multan');
    expect(metroCityFor(null), 'lahore');
  });

  test('bundled lines.json matches the web extract', () {
    final f = File('assets/osm/lines.json');
    expect(f.existsSync(), isTrue, reason: 'run node mobile/tool/sync_osm.mjs');
    expect(f.readAsStringSync(), File('../src/data/osm/lines.json').readAsStringSync());
    expect(parseLines(f.readAsStringSync()), isNotEmpty);
  });
}

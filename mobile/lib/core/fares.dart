// Trip cost/time comparison. Every number is an ESTIMATE from fixed benchmark rates (Lahore, PKR), not a tariff or a quote.
// Port of src/services/fareCalculator.ts. Metrobus and Orange Line are offered only when the trip is in the Lahore area.
import 'dart:math' as math;

import 'geo.dart';
import 'places.dart' show lahoreCentre, dataCoverageKm;

const petrolPricePkr = 265.0; // Rs per litre (benchmark)
const bikeKmPerLitre = 48.0;
const carKmPerLitre = 13.5;

class FareOption {
  const FareOption({required this.mode, required this.costPkr, required this.minutes, required this.co2g, this.cheapest = false, this.fastest = false});
  final String mode; // key into the fare* strings
  final int costPkr, minutes, co2g;
  final bool cheapest, fastest;
  FareOption tag({bool? cheapest, bool? fastest}) => FareOption(mode: mode, costPkr: costPkr, minutes: minutes, co2g: co2g, cheapest: cheapest ?? this.cheapest, fastest: fastest ?? this.fastest);
}

bool inLahoreArea(LatLng p) => haversineM(p, lahoreCentre) <= dataCoverageKm * 1000;

int _orangeLineFare(double km, bool student) {
  final f = km <= 4 ? 20 : km <= 8 ? 25 : km <= 12 ? 30 : km <= 16 ? 35 : 40;
  return student ? (f / 2).round() : f;
}

List<FareOption> compareModes({required double distanceKm, required int durationMinutes, bool student = false, bool lahore = true}) {
  final d = math.max(0.5, distanceKm);
  final t = math.max(2, durationMinutes);
  final all = <FareOption>[
    if (lahore) FareOption(mode: 'orangeline', costPkr: _orangeLineFare(d, student), minutes: (d * 1.8).round() + 4, co2g: (d * 15).round()),
    if (lahore) FareOption(mode: 'metrobus', costPkr: student ? 15 : 30, minutes: (t * 0.85).round() + 5, co2g: (d * 35).round()),
    FareOption(mode: 'motorbike', costPkr: math.max(15, (d / bikeKmPerLitre * petrolPricePkr).round()), minutes: (t * 0.8).round(), co2g: (d * 60).round()),
    FareOption(mode: 'car', costPkr: math.max(80, (d / carKmPerLitre * petrolPricePkr).round()), minutes: t, co2g: (d * 160).round()),
    FareOption(mode: 'rickshaw', costPkr: math.max(70, (60 + d * 26).round()), minutes: (t * 1.1).round(), co2g: (d * 85).round()),
    FareOption(mode: 'rideHail', costPkr: math.max(180, (140 + d * 38).round()), minutes: t + 5, co2g: (d * 150).round()),
    FareOption(mode: 'walking', costPkr: 0, minutes: (d * 12).round(), co2g: 0),
  ];
  final paid = all.where((o) => o.mode != 'walking');
  final cheap = paid.reduce((a, b) => b.costPkr < a.costPkr ? b : a).mode;
  final fast = all.reduce((a, b) => b.minutes < a.minutes ? b : a).mode;
  return [for (final o in all) o.tag(cheapest: o.mode == cheap, fastest: o.mode == fast)];
}

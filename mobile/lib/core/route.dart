import 'geo.dart';

enum TravelMode { driving, walking, twoWheeler }

class NavStep {
  const NavStep({
    required this.instruction,
    required this.instructionUrdu,
    required this.distanceMeters,
    required this.durationSeconds,
    required this.maneuver,
  });
  final String instruction;
  final String instructionUrdu;
  final int distanceMeters;
  final int durationSeconds;

  /// straight | turn-left | turn-right | u-turn | roundabout | merge | arrive
  final String maneuver;
}

class RouteOption {
  const RouteOption({
    required this.id,
    required this.title,
    required this.titleUrdu,
    required this.via,
    required this.viaUrdu,
    required this.distanceKm,
    required this.durationMinutes,
    required this.isRecommended,
    required this.steps,
    required this.path,
    this.hasTolls = false,
  });
  final String id;
  final String title;
  final String titleUrdu;
  final String via;
  final String viaUrdu;
  final double distanceKm;
  final int durationMinutes;
  final bool isRecommended;
  final bool hasTolls;
  final List<NavStep> steps;
  final List<LatLng> path;
}

import 'geo.dart';
import 'route.dart';
import 'route_matcher.dart';

enum NavStatus { navigating, offRoute, arrived }

class Fix {
  const Fix({required this.lat, required this.lng, this.accuracy, this.speed, this.heading, this.timestamp});
  final double lat;
  final double lng;
  final double? accuracy;
  final double? speed;
  final double? heading;
  final int? timestamp;
  LatLng get point => LatLng(lat, lng);
}

const double arrivalRadiusM = 25;
const double offRouteMinM = 50;
const int offRouteFixes = 3;

class NavSession {
  const NavSession({
    required this.routeId,
    required this.status,
    required this.totalM,
    required this.alongM,
    required this.remainingM,
    required this.remainingS,
    required this.stepIndex,
    required this.upcomingStepIndex,
    required this.distanceToManeuverM,
    required this.distFromRouteM,
    required this.snapped,
    required this.offRouteCount,
    required this.cum,
    required this.stepEndsM,
  });

  final String routeId;
  final NavStatus status;
  final double totalM;
  final double alongM;
  final double remainingM;
  final int remainingS;

  /// Step currently being driven; the upcoming manoeuvre is [upcomingStepIndex].
  final int stepIndex;
  final int upcomingStepIndex;
  final double distanceToManeuverM;
  final double distFromRouteM;

  /// The fix projected onto the route (where the vehicle is drawn). null before the first match and while off route.
  final LatLng? snapped;
  final int offRouteCount;
  final List<double> cum;
  final List<double> stepEndsM;

  NavSession copyWith({
    NavStatus? status,
    double? alongM,
    double? remainingM,
    int? remainingS,
    int? stepIndex,
    int? upcomingStepIndex,
    double? distanceToManeuverM,
    double? distFromRouteM,
    LatLng? snapped,
    bool clearSnapped = false,
    int? offRouteCount,
  }) =>
      NavSession(
        routeId: routeId,
        status: status ?? this.status,
        totalM: totalM,
        alongM: alongM ?? this.alongM,
        remainingM: remainingM ?? this.remainingM,
        remainingS: remainingS ?? this.remainingS,
        stepIndex: stepIndex ?? this.stepIndex,
        upcomingStepIndex: upcomingStepIndex ?? this.upcomingStepIndex,
        distanceToManeuverM: distanceToManeuverM ?? this.distanceToManeuverM,
        distFromRouteM: distFromRouteM ?? this.distFromRouteM,
        snapped: clearSnapped ? null : (snapped ?? this.snapped),
        offRouteCount: offRouteCount ?? this.offRouteCount,
        cum: cum,
        stepEndsM: stepEndsM,
      );
}

NavSession createSession(RouteOption route) {
  final cum = cumulativeLengths(route.path);
  final totalM = cum.isEmpty ? 0.0 : cum.last;
  final stepSum = route.steps.fold<int>(0, (s, st) => s + st.distanceMeters);
  final scale = stepSum > 0 ? totalM / stepSum : 1.0;
  var acc = 0.0;
  final stepEnds = route.steps.map((st) => acc += st.distanceMeters * scale).toList();
  if (stepEnds.isNotEmpty) stepEnds[stepEnds.length - 1] = totalM;
  final n = route.steps.length;
  return NavSession(
    routeId: route.id,
    status: NavStatus.navigating,
    totalM: totalM,
    alongM: 0,
    remainingM: totalM,
    remainingS: route.durationMinutes * 60,
    stepIndex: 0,
    upcomingStepIndex: (n - 1).clamp(0, 1),
    distanceToManeuverM: stepEnds.isNotEmpty ? stepEnds.first : totalM,
    distFromRouteM: 0,
    snapped: null,
    offRouteCount: 0,
    cum: cum,
    stepEndsM: stepEnds,
  );
}

/// Pure update: returns a new session for a GPS fix. Never mutates the input.
NavSession updateSession(NavSession session, RouteOption route, Fix fix) {
  if (session.status == NavStatus.arrived || route.id != session.routeId) return session;
  final path = route.path;
  final dest = path.isEmpty ? null : path.last;

  if (dest != null && haversineM(fix.point, dest) <= arrivalRadiusM) {
    return session.copyWith(status: NavStatus.arrived, snapped: dest, alongM: session.totalM, remainingM: 0, remainingS: 0, distanceToManeuverM: 0);
  }

  final match = matchToRoute(path, session.cum, fix.point, lastAlongM: session.alongM);
  if (match == null) return session;

  // Be tolerant when the receiver itself reports poor accuracy.
  final threshold = offRouteMinM > (fix.accuracy ?? 0).clamp(0, 150) ? offRouteMinM : (fix.accuracy ?? 0).clamp(0, 150).toDouble();
  if (match.distFromRouteM > threshold) {
    final count = session.offRouteCount + 1;
    final off = count >= offRouteFixes;
    return session.copyWith(
      distFromRouteM: match.distFromRouteM,
      offRouteCount: count,
      clearSnapped: off,
      status: off ? NavStatus.offRoute : session.status,
    );
  }

  final alongM = match.alongM > session.alongM ? match.alongM : session.alongM; // progress never goes backwards
  final remainingM = (session.totalM - alongM).clamp(0, double.infinity).toDouble();
  var stepIndex = session.stepEndsM.indexWhere((end) => alongM < end);
  if (stepIndex == -1) stepIndex = session.stepEndsM.isEmpty ? 0 : session.stepEndsM.length - 1;
  final lastStep = route.steps.isEmpty ? 0 : route.steps.length - 1;
  final upcoming = stepIndex + 1 < lastStep ? stepIndex + 1 : lastStep;
  final fraction = session.totalM > 0 ? remainingM / session.totalM : 0.0;
  final stepEnd = stepIndex < session.stepEndsM.length ? session.stepEndsM[stepIndex] : session.totalM;

  return session.copyWith(
    status: NavStatus.navigating,
    alongM: alongM,
    remainingM: remainingM,
    remainingS: (route.durationMinutes * 60 * fraction).round(),
    stepIndex: stepIndex,
    upcomingStepIndex: upcoming,
    distanceToManeuverM: (stepEnd - alongM).clamp(0, double.infinity).roundToDouble(),
    distFromRouteM: match.distFromRouteM,
    snapped: match.point,
    offRouteCount: 0,
  );
}

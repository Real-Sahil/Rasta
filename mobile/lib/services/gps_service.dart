import 'dart:async';
import 'dart:io' show Platform;

import 'package:geolocator/geolocator.dart';

import '../core/geo.dart';
import '../core/navigation.dart';

enum GpsProblem { none, serviceOff, permissionDenied, permissionForever }

/// Real GPS only. No fix means no location: nothing is ever invented or defaulted to a city.
/// Android: a foreground-service notification keeps fixes coming with the screen locked.
/// iOS: background location updates with the blue status-bar indicator.
class GpsService {
  StreamSubscription<Position>? _sub;
  Fix? _last;
  DateTime? _lastAt;

  Future<GpsProblem> ensurePermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return GpsProblem.serviceOff;
    var p = await Geolocator.checkPermission();
    if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
    if (p == LocationPermission.deniedForever) return GpsProblem.permissionForever;
    if (p == LocationPermission.denied) return GpsProblem.permissionDenied;
    return GpsProblem.none;
  }

  LocationSettings _settings(bool background, String notificationTitle, String notificationText) {
    if (!background) return const LocationSettings(accuracy: LocationAccuracy.best, distanceFilter: 0);
    if (Platform.isAndroid) {
      return AndroidSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 0,
        intervalDuration: const Duration(seconds: 1),
        foregroundNotificationConfig: ForegroundNotificationConfig(
          notificationTitle: notificationTitle,
          notificationText: notificationText,
          enableWakeLock: true,
          setOngoing: true,
        ),
      );
    }
    if (Platform.isIOS) {
      return AppleSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        activityType: ActivityType.automotiveNavigation,
        distanceFilter: 0,
        pauseLocationUpdatesAutomatically: false,
        showBackgroundLocationIndicator: true,
        allowBackgroundLocationUpdates: true,
      );
    }
    return const LocationSettings(accuracy: LocationAccuracy.best, distanceFilter: 0);
  }

  /// Start listening. [background] adds the Android foreground-service notification / iOS background updates, used
  /// only while navigating so an idle app doesn't show a tracking notification. [onFix] gets fixes that pass the glitch filter; [onError] gets stream errors.
  void start({bool background = false, required void Function(Fix) onFix, required void Function(Object) onError, String notificationTitle = 'Buraq navigation', String notificationText = 'Using your location for directions.'}) {
    stop();
    _sub = Geolocator.getPositionStream(locationSettings: _settings(background, notificationTitle, notificationText)).listen((pos) {
      final fix = Fix(
        lat: pos.latitude,
        lng: pos.longitude,
        accuracy: pos.accuracy,
        speed: pos.speed >= 0 ? pos.speed : null,
        heading: pos.heading >= 0 ? pos.heading : null,
        timestamp: pos.timestamp.millisecondsSinceEpoch,
      );
      if (isGlitch(_last, _lastAt, fix, DateTime.now())) return;
      _last = fix;
      _lastAt = DateTime.now();
      onFix(fix);
    }, onError: onError);
  }

  void stop() {
    _sub?.cancel();
    _sub = null;
  }
}

/// A jump of over 1.2 km in under 2 s is a receiver glitch, not movement.
bool isGlitch(Fix? last, DateTime? lastAt, Fix next, DateTime now) {
  if (last == null || lastAt == null) return false;
  final secs = now.difference(lastAt).inMilliseconds / 1000;
  return secs < 2 && haversineM(last.point, next.point) > 1200;
}

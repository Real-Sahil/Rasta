import 'geo.dart';

/// OpenStreetMap link to a point. Built on the device; nothing is sent anywhere until the user picks an app to share with.
String osmLink(LatLng p) =>
    'https://www.openstreetmap.org/?mlat=${p.lat.toStringAsFixed(5)}&mlon=${p.lng.toStringAsFixed(5)}#map=17/${p.lat.toStringAsFixed(5)}/${p.lng.toStringAsFixed(5)}';

String formatClock(DateTime at) => '${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}';

/// Fills {dest}, {eta} and {link} in a localised template.
String buildTripShareText(String template, {required String dest, required int remainingS, required LatLng pos, DateTime? now}) {
  final eta = formatClock((now ?? DateTime.now()).add(Duration(seconds: remainingS < 0 ? 0 : remainingS)));
  return template.replaceFirst('{dest}', dest).replaceFirst('{eta}', eta).replaceFirst('{link}', osmLink(pos));
}

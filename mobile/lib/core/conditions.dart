// Weather and air quality from Open-Meteo (no key). Parsing and banding are pure; null means "unavailable", never a guess.
import 'geo.dart';

const cityCentres = <String, LatLng>{
  'lahore': LatLng(31.5204, 74.3587), 'karachi': LatLng(24.8607, 67.0011), 'islamabad': LatLng(33.6844, 73.0479),
  'rawalpindi': LatLng(33.5651, 73.0169), 'multan': LatLng(30.1575, 71.5249), 'faisalabad': LatLng(31.4504, 73.135),
};

/// Nearest city within 80 km of a real fix, else null (the UI then asks the user to pick one).
String? nearestCity(LatLng? p) {
  if (p == null) return null;
  String? best;
  var bestD = 80000.0;
  cityCentres.forEach((k, c) {
    final d = haversineM(p, c);
    if (d < bestD) { bestD = d; best = k; }
  });
  return best;
}

/// US AQI band key: good, moderate, sensitive, unhealthy, veryUnhealthy, hazardous.
String aqiBand(int aqi) => aqi <= 50 ? 'good' : aqi <= 100 ? 'moderate' : aqi <= 150 ? 'sensitive' : aqi <= 200 ? 'unhealthy' : aqi <= 300 ? 'veryUnhealthy' : 'hazardous';

/// WMO weather code to a condition key.
String conditionKey(int code) {
  if (code == 0) return 'clear';
  if (code <= 3) return 'partlyCloudy';
  if (code == 45 || code == 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 61 && code <= 67) return 'rain';
  if (code >= 80 && code <= 82) return 'showers';
  if (code >= 95) return 'thunderstorm';
  return 'cloudy';
}

/// Waterlogging risk from the last hour's rain (mm): low, moderate, high.
String waterloggingRisk(double rainMm) => rainMm >= 7.5 ? 'high' : rainMm >= 2.5 ? 'moderate' : 'low';

class Conditions {
  const Conditions({this.tempC, this.condition, this.rainMm, this.aqi, this.pm25});
  final int? tempC;
  final String? condition;
  final double? rainMm;
  final int? aqi, pm25;
  bool get isEmpty => tempC == null && aqi == null;
}

Uri weatherUri(LatLng c) => Uri.https('api.open-meteo.com', '/v1/forecast', {'latitude': '${c.lat}', 'longitude': '${c.lng}', 'current': 'temperature_2m,precipitation,weather_code'});
Uri aqiUri(LatLng c) => Uri.https('air-quality-api.open-meteo.com', '/v1/air-quality', {'latitude': '${c.lat}', 'longitude': '${c.lng}', 'current': 'us_aqi,pm2_5'});

Conditions parseWeather(Object? json, Conditions into) {
  final cur = json is Map ? json['current'] : null;
  if (cur is! Map || cur['temperature_2m'] is! num) return into;
  return Conditions(
    tempC: (cur['temperature_2m'] as num).round(),
    condition: conditionKey(((cur['weather_code'] as num?) ?? -1).toInt()),
    rainMm: ((cur['precipitation'] as num?) ?? 0).toDouble(),
    aqi: into.aqi, pm25: into.pm25,
  );
}

Conditions parseAqi(Object? json, Conditions into) {
  final cur = json is Map ? json['current'] : null;
  if (cur is! Map || cur['us_aqi'] is! num) return into;
  return Conditions(tempC: into.tempC, condition: into.condition, rainMm: into.rainMm, aqi: (cur['us_aqi'] as num).round(), pm25: cur['pm2_5'] is num ? (cur['pm2_5'] as num).round() : null);
}

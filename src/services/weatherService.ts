/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { CITY_CENTERS } from '../data/pakistanLocations';

export interface WeatherData {
  temperatureC: number;
  condition: string;
  conditionUrdu: string;
  rainfallMm: number;
  isHeavyRain: boolean;
  waterloggingRisk: 'Low' | 'Moderate' | 'High';
  waterloggingRiskUrdu: string;
}

function describe(code: number): [string, string] {
  if (code === 0) return ['Clear', 'صاف'];
  if (code <= 3) return ['Partly cloudy', 'جزوی ابر آلود'];
  if (code === 45 || code === 48) return ['Fog', 'دھند'];
  if (code >= 51 && code <= 57) return ['Drizzle', 'ہلکی بوندا باندی'];
  if (code >= 61 && code <= 67) return ['Rain', 'بارش'];
  if (code >= 80 && code <= 82) return ['Rain showers', 'بارش کی بوچھاڑ'];
  if (code >= 95) return ['Thunderstorm', 'گرج چمک کے ساتھ بارش'];
  return ['Cloudy', 'ابر آلود'];
}

// Real data from Open-Meteo (no key). Returns null when unavailable.
export async function fetchCityWeather(city: string): Promise<WeatherData | null> {
  const c = CITY_CENTERS[city.toLowerCase()] || CITY_CENTERS.lahore;
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}&current=temperature_2m,precipitation,weather_code`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const cur = (await res.json())?.current;
    if (!cur || !Number.isFinite(Number(cur.temperature_2m))) return null;
    const rain = Number(cur.precipitation) || 0; // mm in the last hour
    const [condition, conditionUrdu] = describe(Number(cur.weather_code));
    let risk: WeatherData['waterloggingRisk'] = 'Low';
    let riskUrdu = 'کم خطرہ';
    if (rain >= 7.5) { risk = 'High'; riskUrdu = 'شدید خطرہ'; }
    else if (rain >= 2.5) { risk = 'Moderate'; riskUrdu = 'درمیانہ خطرہ'; }
    return {
      temperatureC: Math.round(cur.temperature_2m),
      condition,
      conditionUrdu,
      rainfallMm: rain,
      isHeavyRain: rain >= 7.5,
      waterloggingRisk: risk,
      waterloggingRiskUrdu: riskUrdu
    };
  } catch {
    return null;
  }
}

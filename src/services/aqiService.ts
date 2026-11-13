/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { CITY_CENTERS } from '../data/pakistanLocations';

export interface CityAqiData {
  aqi: number; // US AQI, 0-500
  status: 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';
  statusUrdu: string;
  pm25: number;
  colorClass: string;
}

// Real data from Open-Meteo Air Quality API (no key). Returns null when unavailable.
export async function fetchCityAqi(city: string): Promise<CityAqiData | null> {
  const c = CITY_CENTERS[city.toLowerCase()] || CITY_CENTERS.lahore;
  try {
    const res = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${c.lat}&longitude=${c.lng}&current=us_aqi,pm2_5`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const aqi = Number(data?.current?.us_aqi);
    const pm25 = Number(data?.current?.pm2_5);
    if (!Number.isFinite(aqi)) return null;

    let status: CityAqiData['status'] = 'Hazardous';
    let statusUrdu = 'انتہائی خطرناک';
    let colorClass = 'bg-rose-700 text-white';
    if (aqi <= 50) { status = 'Good'; statusUrdu = 'بہترین'; colorClass = 'bg-emerald-600 text-white'; }
    else if (aqi <= 100) { status = 'Moderate'; statusUrdu = 'تسلی بخش'; colorClass = 'bg-amber-500 text-slate-950 font-bold'; }
    else if (aqi <= 150) { status = 'Unhealthy for Sensitive Groups'; statusUrdu = 'حساس افراد کے لیے مضر'; colorClass = 'bg-orange-600 text-white'; }
    else if (aqi <= 200) { status = 'Unhealthy'; statusUrdu = 'مضر صحت'; colorClass = 'bg-red-600 text-white'; }
    else if (aqi <= 300) { status = 'Very Unhealthy'; statusUrdu = 'انتہائی مضر صحت'; colorClass = 'bg-purple-600 text-white'; }

    return { aqi: Math.round(aqi), status, statusUrdu, pm25: Number.isFinite(pm25) ? Math.round(pm25) : 0, colorClass };
  } catch {
    return null;
  }
}

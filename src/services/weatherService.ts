/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WeatherData {
  temperatureC: number;
  condition: string;
  conditionUrdu: string;
  rainfallMm: number;
  isHeavyRain: boolean;
  waterloggingRisk: 'Low' | 'Moderate' | 'High';
  waterloggingRiskUrdu: string;
}

export async function fetchCityWeather(city: string): Promise<WeatherData> {
  try {
    // Simulate real-time weather API fetch for Pakistani urban centers during monsoon/winter
    const cityKey = city.toLowerCase();
    const isMonsoonSeason = true;
    const rainfallMm = isMonsoonSeason ? Math.round(Math.random() * 35 * 10) / 10 : 0;
    const isHeavyRain = rainfallMm > 15;
    const temp = cityKey === 'islamabad' ? 26 : 33;

    let risk: WeatherData['waterloggingRisk'] = 'Low';
    let riskUrdu = 'کم خطرہ';
    if (rainfallMm > 25) {
      risk = 'High';
      riskUrdu = 'شدید خطرہ (انڈرپاسز بند)';
    } else if (rainfallMm > 10) {
      risk = 'Moderate';
      riskUrdu = 'درمیانہ خطرہ';
    }

    return {
      temperatureC: temp,
      condition: isHeavyRain ? 'Heavy Monsoon Rain' : rainfallMm > 0 ? 'Light Drizzle' : 'Clear & Humid',
      conditionUrdu: isHeavyRain ? 'موسلا دھار بارش' : rainfallMm > 0 ? 'ہلکی بوندا باندی' : 'صاف و مرطوب',
      rainfallMm,
      isHeavyRain,
      waterloggingRisk: risk,
      waterloggingRiskUrdu: riskUrdu
    };
  } catch {
    return {
      temperatureC: 31,
      condition: 'Clear',
      conditionUrdu: 'صاف',
      rainfallMm: 0,
      isHeavyRain: false,
      waterloggingRisk: 'Low',
      waterloggingRiskUrdu: 'کم خطرہ'
    };
  }
}

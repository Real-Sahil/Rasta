/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MultimodalCostComparison } from '../types';

// Benchmark market rates in Lahore (PKR)
export const CURRENT_PETROL_PRICE_PKR = 265.0; // Rs. / liter
export const MOTORBIKE_KM_PER_LITER = 48.0;   // CD70 / 125 average city mileage
export const CAR_KM_PER_LITER = 13.5;         // Urban stop-and-go average

export function calculateMultimodalOptions(
  distanceKm: number,
  durationMinutes: number,
  studentConcession = false
): MultimodalCostComparison[] {
  const safeDistance = Math.max(0.5, distanceKm);
  const safeDuration = Math.max(2, durationMinutes);

  // 1. Walking
  const walkingKm = safeDistance;
  const walkingMinutes = Math.round(walkingKm * 12); // ~5 km/h
  const walking: MultimodalCostComparison = {
    mode: 'walking',
    title: 'Walking (پیدل)',
    titleUrdu: 'پیدل سفر',
    costPkr: 0,
    durationMinutes: walkingMinutes,
    distanceKm: walkingKm,
    co2Grams: 0,
    comfortRating: 2,
    highlights: ['No cost', 'No emissions'],
    highlightsUrdu: ['کوئی کرایہ نہیں', 'صفر کاربن اخراج']
  };

  // 2. Lahore Metrobus
  const metroFare = studentConcession ? 15 : 30;
  const metroDuration = Math.round(safeDuration * 0.85) + 5; // dedicated busway avoids road traffic
  const metrobus: MultimodalCostComparison = {
    mode: 'metrobus',
    title: 'Lahore Metrobus (PMA)',
    titleUrdu: 'لاہور میٹرو بس (سرکاری)',
    costPkr: metroFare,
    durationMinutes: metroDuration,
    distanceKm: safeDistance,
    co2Grams: Math.round(safeDistance * 35),
    comfortRating: 4,
    highlights: ['Dedicated bus lane', 'Flat fare (estimate)'],
    highlightsUrdu: ['مخصوص بس لین', 'یکساں کرایہ (اندازہ)']
  };

  // 3. Orange Line Metro Train
  let olFare = 40;
  if (safeDistance <= 4) olFare = 20;
  else if (safeDistance <= 8) olFare = 25;
  else if (safeDistance <= 12) olFare = 30;
  else if (safeDistance <= 16) olFare = 35;
  else olFare = 40;

  if (studentConcession) olFare = Math.round(olFare / 2);
  const olDuration = Math.round(safeDistance * 1.8) + 4; // High-speed electric train
  const orangeline: MultimodalCostComparison = {
    mode: 'orangeline',
    title: 'Orange Line Metro Train (OLMT)',
    titleUrdu: 'اورنج لائن میٹرو ٹرین',
    costPkr: olFare,
    durationMinutes: olDuration,
    distanceKm: safeDistance,
    co2Grams: Math.round(safeDistance * 15),
    comfortRating: 5,
    highlights: ['Electric train on its own track', 'Distance-based fare (estimate)'],
    highlightsUrdu: ['اپنے ٹریک پر الیکٹرک ٹرین', 'فاصلے کے مطابق کرایہ (اندازہ)']
  };

  // 4. Motorbike (Honda CD70 / CG125)
  const bikeFuelLiters = safeDistance / MOTORBIKE_KM_PER_LITER;
  const bikeCost = Math.round(bikeFuelLiters * CURRENT_PETROL_PRICE_PKR);
  const bikeDuration = Math.round(safeDuration * 0.8); // lane splitting in Lahore traffic
  const motorbike: MultimodalCostComparison = {
    mode: 'motorbike',
    title: 'Motorbike (70cc / 125cc)',
    titleUrdu: 'موٹر سائیکل (بائیک)',
    costPkr: Math.max(15, bikeCost),
    durationMinutes: bikeDuration,
    distanceKm: safeDistance,
    co2Grams: Math.round(safeDistance * 60),
    comfortRating: 3,
    highlights: ['Easy navigation in narrow bazaars', 'Extremely economical fuel', 'Door-to-door flexibility'],
    highlightsUrdu: ['پتلی گلیوں اور رش سے نکلنے میں آسان', 'کم ترین پٹرول خرچ', 'دروازے سے دروازے تک']
  };

  // 5. Private Car (1000cc)
  const carFuelLiters = safeDistance / CAR_KM_PER_LITER;
  const carCost = Math.round(carFuelLiters * CURRENT_PETROL_PRICE_PKR);
  const car: MultimodalCostComparison = {
    mode: 'car',
    title: 'Private Car (1000cc-1300cc)',
    titleUrdu: 'ذاتی کار',
    costPkr: Math.max(80, carCost),
    durationMinutes: safeDuration,
    distanceKm: safeDistance,
    co2Grams: Math.round(safeDistance * 160),
    comfortRating: 4,
    highlights: ['Personal AC comfort', 'Subject to peak hour bottlenecks', 'Parking search required'],
    highlightsUrdu: ['ذاتی پرائیویسی اور اے سی', 'رش کے اوقات میں تاخیر ممکن', 'پارکنگ تلاش کی ضرورت']
  };

  // 6. Rickshaw / Chingchi
  const rickshawCost = Math.round(60 + safeDistance * 26);
  const rickshawDuration = Math.round(safeDuration * 1.1);
  const rickshaw: MultimodalCostComparison = {
    mode: 'rickshaw',
    title: 'Auto / Chingchi Rickshaw',
    titleUrdu: 'آٹو رکشہ / چنگ چی',
    costPkr: Math.max(70, rickshawCost),
    durationMinutes: rickshawDuration,
    distanceKm: safeDistance,
    co2Grams: Math.round(safeDistance * 85),
    comfortRating: 2,
    highlights: ['Readily available at every chowk', 'No app required', 'Negotiate fare or use meter'],
    highlightsUrdu: ['ہر چوک پر باآسانی دستیاب', 'کسی ایپ کی ضرورت نہیں', 'لوکل کرایہ']
  };

  // 7. Ride Hailing (InDrive / Careem / Bykea)
  const rideHailingCost = Math.round(140 + safeDistance * 38);
  const rideHailingDuration = safeDuration + 5; // 5 mins pickup wait
  const rideHailing: MultimodalCostComparison = {
    mode: 'ride_hailing',
    title: 'App Cab (Careem / InDrive / Yango)',
    titleUrdu: 'آن لائن ٹیکسی سروس',
    costPkr: Math.max(180, rideHailingCost),
    durationMinutes: rideHailingDuration,
    distanceKm: safeDistance,
    co2Grams: Math.round(safeDistance * 150),
    comfortRating: 5,
    highlights: ['Doorstep pickup', 'Tracked vehicle & live safety', 'Cash, JazzCash or card'],
    highlightsUrdu: ['گھر کی دہلیز سے سواری', 'لائیو ٹریکنگ اور محفوظ سفر', 'جاز کیش یا نقد ادائیگی']
  };

  const all = [orangeline, metrobus, motorbike, car, rickshaw, rideHailing, walking];

  // Tag cheapest (excluding walking if distance > 2 km, or include if < 2)
  const nonWalk = all.filter(o => o.mode !== 'walking');
  const cheapestOption = nonWalk.reduce((min, cur) => cur.costPkr < min.costPkr ? cur : min, nonWalk[0]);
  cheapestOption.isCheapest = true;

  const fastestOption = all.reduce((min, cur) => cur.durationMinutes < min.durationMinutes ? cur : min, all[0]);
  fastestOption.isFastest = true;

  return all;
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { RouteOption } from '../types';

export type RouteStep = RouteOption['steps'][number];

// Build readable instructions from OSRM maneuver data (OSRM does not return instruction text)
export function osrmStep(s: any): RouteStep {
  const type: string = s.maneuver?.type || 'continue';
  const mod: string = s.maneuver?.modifier || 'straight';
  const name: string = s.name ? String(s.name) : '';
  const onto = name ? ` onto ${name}` : '';
  const modUr: Record<string, string> = {
    left: 'بائیں مڑیں', right: 'دائیں مڑیں', straight: 'سیدھا چلیں',
    'slight left': 'ہلکا بائیں مڑیں', 'slight right': 'ہلکا دائیں مڑیں',
    'sharp left': 'تیز بائیں مڑیں', 'sharp right': 'تیز دائیں مڑیں', uturn: 'یو ٹرن لیں'
  };
  let instruction: string;
  let instructionUrdu: string;
  let maneuver: RouteStep['maneuver'] = 'straight';
  if (type === 'arrive') {
    instruction = 'Arrive at destination'; instructionUrdu = 'منزل پر پہنچیں'; maneuver = 'arrive';
  } else if (type === 'depart') {
    instruction = name ? `Head out on ${name}` : 'Head toward destination'; instructionUrdu = 'روانہ ہوں';
  } else if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') {
    instruction = `Enter the roundabout${onto}`; instructionUrdu = 'چوراہے میں داخل ہوں'; maneuver = 'roundabout';
  } else if (type === 'merge') {
    instruction = `Merge${onto}`; instructionUrdu = 'سڑک میں شامل ہوں'; maneuver = 'merge';
  } else {
    const dir = mod === 'straight' ? 'Continue straight' : mod === 'uturn' ? 'Make a U-turn' : `Turn ${mod}`;
    instruction = `${dir}${onto}`; instructionUrdu = modUr[mod] || 'آگے بڑھیں';
    if (mod.includes('left')) maneuver = 'turn-left';
    else if (mod.includes('right')) maneuver = 'turn-right';
    else if (mod === 'uturn') maneuver = 'u-turn';
  }
  return {
    instruction, instructionUrdu, maneuver,
    distanceMeters: Math.round(s.distance), durationSeconds: Math.round(s.duration)
  };
}

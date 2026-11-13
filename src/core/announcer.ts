/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { RouteOption } from '../types';
import { NavSession } from './navigation';

export interface Announcement {
  key: string;
  en: string;
  ur: string;
}

export const ANNOUNCE_BANDS_M = [500, 200, 50];

const round10 = (n: number) => Math.max(10, Math.round(n / 10) * 10);

/**
 * Decide whether a spoken prompt is due. Each (manoeuvre, band) pair is spoken once;
 * `announced` is the set of keys already spoken for this trip.
 */
export function nextAnnouncement(
  session: NavSession,
  route: RouteOption,
  announced: ReadonlySet<string>
): Announcement | null {
  if (session.status === 'arrived') {
    const key = `${route.id}:arrived`;
    return announced.has(key) ? null : { key, en: 'You have arrived at your destination', ur: 'آپ اپنی منزل پر پہنچ گئے ہیں' };
  }
  if (session.status !== 'navigating') return null;
  const step = route.steps[session.upcomingStepIndex];
  if (!step) return null;
  const d = session.distanceToManeuverM;
  const band = [...ANNOUNCE_BANDS_M].sort((a, b) => a - b).find((b) => d <= b);
  if (band === undefined) return null;
  const key = `${route.id}:${session.upcomingStepIndex}:${band}`;
  if (announced.has(key)) return null;
  if (band === ANNOUNCE_BANDS_M[ANNOUNCE_BANDS_M.length - 1]) {
    return { key, en: step.instruction, ur: step.instructionUrdu };
  }
  const m = round10(d);
  return { key, en: `In ${m} meters, ${step.instruction}`, ur: `${m} میٹر بعد، ${step.instructionUrdu}` };
}

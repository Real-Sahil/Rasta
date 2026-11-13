/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { RouteOption } from '../types';
import { LatLng, cumulativeLengths, haversineM } from './geo';
import { matchToRoute } from './routeMatcher';

export type NavStatus = 'navigating' | 'off_route' | 'arrived';

export interface Fix extends LatLng {
  accuracy?: number;
  speed?: number | null;
  heading?: number | null;
  timestamp?: number;
}

export interface NavSession {
  routeId: string;
  status: NavStatus;
  totalM: number;
  alongM: number;
  remainingM: number;
  remainingS: number;
  /** Step currently being driven. The upcoming manoeuvre is `upcomingStepIndex`. */
  stepIndex: number;
  upcomingStepIndex: number;
  distanceToManeuverM: number;
  distFromRouteM: number;
  offRouteCount: number;
  cum: number[]; // route vertex distances (internal)
  stepEndsM: number[]; // cumulative end distance of every step, scaled to route length
}

export const ARRIVAL_RADIUS_M = 25;
export const OFF_ROUTE_MIN_M = 50;
export const OFF_ROUTE_FIXES = 3;

export function createSession(route: RouteOption): NavSession {
  const cum = cumulativeLengths(route.pathCoordinates);
  const totalM = cum[cum.length - 1] || 0;
  const stepSum = route.steps.reduce((s, st) => s + st.distanceMeters, 0);
  const scale = stepSum > 0 ? totalM / stepSum : 1;
  let acc = 0;
  const stepEndsM = route.steps.map((st) => (acc += st.distanceMeters * scale));
  if (stepEndsM.length) stepEndsM[stepEndsM.length - 1] = totalM;
  const s: NavSession = {
    routeId: route.id,
    status: 'navigating',
    totalM,
    alongM: 0,
    remainingM: totalM,
    remainingS: route.durationMinutes * 60,
    stepIndex: 0,
    upcomingStepIndex: Math.min(1, Math.max(0, route.steps.length - 1)),
    distanceToManeuverM: stepEndsM[0] ?? totalM,
    distFromRouteM: 0,
    offRouteCount: 0,
    cum,
    stepEndsM
  };
  return s;
}

/** Pure update: returns a new session for a GPS fix. Never mutates the input. */
export function updateSession(session: NavSession, route: RouteOption, fix: Fix): NavSession {
  if (session.status === 'arrived' || route.id !== session.routeId) return session;
  const path = route.pathCoordinates;
  const dest = path[path.length - 1];

  if (dest && haversineM(fix, dest) <= ARRIVAL_RADIUS_M) {
    return { ...session, status: 'arrived', alongM: session.totalM, remainingM: 0, remainingS: 0, distanceToManeuverM: 0 };
  }

  const match = matchToRoute(path, session.cum, fix, session.alongM);
  if (!match) return session;

  // Be tolerant when the receiver itself reports poor accuracy
  const threshold = Math.max(OFF_ROUTE_MIN_M, Math.min(fix.accuracy ?? 0, 150));
  if (match.distFromRouteM > threshold) {
    const offRouteCount = session.offRouteCount + 1;
    return {
      ...session,
      distFromRouteM: match.distFromRouteM,
      offRouteCount,
      status: offRouteCount >= OFF_ROUTE_FIXES ? 'off_route' : session.status
    };
  }

  const alongM = Math.max(session.alongM, match.alongM); // progress never goes backwards
  const remainingM = Math.max(0, session.totalM - alongM);
  let stepIndex = session.stepEndsM.findIndex((end) => alongM < end);
  if (stepIndex === -1) stepIndex = Math.max(0, session.stepEndsM.length - 1);
  const lastStep = Math.max(0, route.steps.length - 1);
  const upcomingStepIndex = Math.min(stepIndex + 1, lastStep);
  const fraction = session.totalM > 0 ? remainingM / session.totalM : 0;

  return {
    ...session,
    status: 'navigating',
    alongM,
    remainingM,
    remainingS: Math.round(route.durationMinutes * 60 * fraction),
    stepIndex,
    upcomingStepIndex,
    distanceToManeuverM: Math.max(0, Math.round((session.stepEndsM[stepIndex] ?? session.totalM) - alongM)),
    distFromRouteM: match.distFromRouteM,
    offRouteCount: 0
  };
}

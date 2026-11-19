/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect } from 'react';
import { useAppStore } from '../core/store';

/** Recompute routes when destination, mode or (roughly 200 m of) start position change. Frozen during a trip. */
export function useRoutePlanner() {
  const destId = useAppStore((s) => s.destination?.id);
  const mode = useAppStore((s) => s.travelMode);
  const originId = useAppStore((s) => s.origin?.id);
  const inTrip = useAppStore((s) => s.session !== null);
  const startKey = useAppStore((s) => {
    const p = s.origin ?? s.fix ?? s.cityCenter;
    return `${Math.round(p.lat * 500)}_${Math.round(p.lng * 500)}`;
  });
  useEffect(() => {
    if (destId && !inTrip) void useAppStore.getState().loadRoutes();
  }, [destId, mode, startKey, inTrip, originId]);
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect } from 'react';
import { RobustGpsManager } from '../services/gpsService';
import { useAppStore } from '../core/store';

/** Watch the device GPS and feed real fixes into the store. No fixes means no location: nothing is invented. */
export function useGpsTracking(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const mgr = new RobustGpsManager((state) => {
      const { setGps, setFix } = useAppStore.getState();
      setGps({ signalLost: state.isSignalLost, accuracyWarning: state.accuracyWarning, error: state.error ? state.errorMessage : null });
      const loc = state.smoothedLocation;
      if (loc) setFix({ lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, speed: loc.speed, heading: loc.heading, timestamp: loc.timestamp });
    });
    mgr.startWatching();
    return () => mgr.stopWatching();
  }, [enabled]);
}

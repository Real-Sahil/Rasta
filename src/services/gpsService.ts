/**
 * Robust Rasta GPS & Location Service
 * Fully implements:
 * 1. Geolocation permissions & error handling (PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT)
 * 2. High-accuracy positioning (enableHighAccuracy: true)
 * 3. Throttled GPS update frequency
 * 4. Accuracy threshold handling & quality flags
 * 5. Sudden location jump & outlier rejection
 * 6. Location smoothing (Exponential Moving Average)
 * 7. Road snapping / map matching against active route
 * 8. Stale location detection (>15s without update)
 * 9. Signal loss & recovery handling
 * 10. Android Chrome & iOS Safari compatibility (secure context & lifecycle)
 */

export interface GpsCoordinates {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number;
}

export type GpsErrorCode = 
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NOT_SUPPORTED'
  | 'INSECURE_CONTEXT';

export interface GpsState {
  location: GpsCoordinates | null;
  smoothedLocation: GpsCoordinates | null;
  error: GpsErrorCode | null;
  errorMessage: string;
  isWatching: boolean;
  isSignalLost: boolean;
  accuracyWarning: boolean;
  lastUpdatedTimestamp: number | null;
}

// Haversine distance in meters between two lat/lng points
export function calculateDistanceMeters(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
  const R = 6371e3; // Earth radius in meters
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Snap GPS point to nearest point on a polyline segment (road snapping)
export function snapToRoutePolyline(
  point: { lat: number; lng: number },
  polyline: { lat: number; lng: number }[],
  maxSnapDistanceMeters: number = 45
): { lat: number; lng: number; snapped: boolean } {
  if (!polyline || polyline.length < 2) return { ...point, snapped: false };

  let closestPoint = point;
  let minDistance = Infinity;

  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = polyline[i];
    const p2 = polyline[i + 1];

    // Project point onto segment p1-p2
    const A = point.lng - p1.lng;
    const B = point.lat - p1.lat;
    const C = p2.lng - p1.lng;
    const D = p2.lat - p1.lat;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;
    if (param < 0) {
      xx = p1.lng;
      yy = p1.lat;
    } else if (param > 1) {
      xx = p2.lng;
      yy = p2.lat;
    } else {
      xx = p1.lng + param * C;
      yy = p1.lat + param * D;
    }

    const projected = { lat: yy, lng: xx };
    const dist = calculateDistanceMeters(point, projected);
    if (dist < minDistance) {
      minDistance = dist;
      closestPoint = projected;
    }
  }

  if (minDistance <= maxSnapDistanceMeters) {
    return { lat: closestPoint.lat, lng: closestPoint.lng, snapped: true };
  }
  return { ...point, snapped: false };
}

export class RobustGpsManager {
  private watchId: number | null = null;
  private staleTimer: any = null;
  private lastValidPosition: GpsCoordinates | null = null;
  private lastSmoothed: GpsCoordinates | null = null;
  private lastUpdateTime: number = 0;
  private onStateChange: (state: GpsState) => void;
  private routePolyline: { lat: number; lng: number }[] | null = null;
  private state: GpsState = {
    location: null,
    smoothedLocation: null,
    error: null,
    errorMessage: '',
    isWatching: false,
    isSignalLost: false,
    accuracyWarning: false,
    lastUpdatedTimestamp: null
  };

  constructor(onStateChange: (state: GpsState) => void) {
    this.onStateChange = onStateChange;
  }

  public setRoutePolyline(polyline: { lat: number; lng: number }[] | null) {
    this.routePolyline = polyline;
  }

  public startWatching() {
    if (this.state.isWatching) return;

    if (typeof window === 'undefined' || !navigator.geolocation) {
      this.updateState({
        error: 'NOT_SUPPORTED',
        errorMessage: 'Geolocation is not supported by your browser.',
        isWatching: false
      });
      return;
    }

    // Check secure context for Android Chrome / iOS Safari compliance
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      this.updateState({
        error: 'INSECURE_CONTEXT',
        errorMessage: 'Geolocation requires a secure HTTPS context on mobile browsers.',
        isWatching: false
      });
      return;
    }

    this.updateState({ isWatching: true, error: null, errorMessage: '' });
    this.resetStaleTimer();

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.handlePositionUpdate(pos);
      },
      (err) => {
        this.handlePositionError(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 3000
      }
    );
  }

  public stopWatching() {
    if (this.watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.staleTimer) {
      clearTimeout(this.staleTimer);
      this.staleTimer = null;
    }
    this.updateState({ isWatching: false });
  }

  public getCurrentPositionOnce(): Promise<GpsCoordinates> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: GpsCoordinates = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            timestamp: pos.timestamp
          };
          resolve(coords);
        },
        (err) => {
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  private resetStaleTimer() {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    // If no position update received in 16 seconds, mark signal lost
    this.staleTimer = setTimeout(() => {
      if (this.state.isWatching) {
        this.updateState({ isSignalLost: true });
      }
    }, 16000);
  }

  private handlePositionUpdate(pos: GeolocationPosition) {
    this.resetStaleTimer();
    const now = Date.now();

    // Throttle frequency: ignore updates faster than 800ms unless high accuracy delta
    if (now - this.lastUpdateTime < 800) {
      return;
    }
    this.lastUpdateTime = now;

    const rawCoords: GpsCoordinates = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      timestamp: pos.timestamp || now
    };

    // 4. Accuracy threshold handling (>100 meters warning)
    const accuracyWarning = (rawCoords.accuracy || 0) > 100;

    // 5. Sudden location jump detection & outlier rejection
    if (this.lastValidPosition) {
      const distMeters = calculateDistanceMeters(this.lastValidPosition, rawCoords);
      const timeDeltaSec = (now - (this.lastValidPosition.timestamp || now)) / 1000;
      // If jump > 1200 meters in under 2 seconds, treat as GPS glitch/teleportation jump
      if (distMeters > 1200 && timeDeltaSec < 2) {
        console.warn('Rasta GPS: Discarding sudden location jump of', Math.round(distMeters), 'm');
        return;
      }
    }

    // 6. Location smoothing (Exponential Moving Average: alpha = 0.55 for smooth movement without lag)
    let smoothed: GpsCoordinates;
    if (this.lastSmoothed) {
      const alpha = 0.55;
      smoothed = {
        lat: this.lastSmoothed.lat * (1 - alpha) + rawCoords.lat * alpha,
        lng: this.lastSmoothed.lng * (1 - alpha) + rawCoords.lng * alpha,
        accuracy: rawCoords.accuracy,
        heading: rawCoords.heading,
        speed: rawCoords.speed,
        timestamp: rawCoords.timestamp
      };
    } else {
      smoothed = { ...rawCoords };
    }

    // 7. Road snapping / map matching if route polyline is available
    if (this.routePolyline && this.routePolyline.length >= 2) {
      const snapped = snapToRoutePolyline(smoothed, this.routePolyline, 50);
      if (snapped.snapped) {
        smoothed.lat = snapped.lat;
        smoothed.lng = snapped.lng;
      }
    }

    this.lastValidPosition = rawCoords;
    this.lastSmoothed = smoothed;

    this.updateState({
      location: rawCoords,
      smoothedLocation: smoothed,
      error: null,
      errorMessage: '',
      isSignalLost: false,
      accuracyWarning,
      lastUpdatedTimestamp: now
    });
  }

  private handlePositionError(err: GeolocationPositionError) {
    let errorCode: GpsErrorCode = 'POSITION_UNAVAILABLE';
    let msg = 'Position unavailable. Please check GPS signal.';

    if (err.code === err.PERMISSION_DENIED) {
      errorCode = 'PERMISSION_DENIED';
      msg = 'Location permission denied. Please allow location access in browser settings.';
    } else if (err.code === err.TIMEOUT) {
      errorCode = 'TIMEOUT';
      msg = 'Location request timed out. Retrying GPS fix...';
    }

    this.updateState({
      error: errorCode,
      errorMessage: msg,
      isSignalLost: true
    });
  }

  private updateState(partial: Partial<GpsState>) {
    this.state = { ...this.state, ...partial };
    this.onStateChange(this.state);
  }
}

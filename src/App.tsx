/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  MobilityThemeProvider,
  useMobilityTheme
} from './components/ThemeLayoutWrapper';
import {
  LocationPoint,
  TravelMode,
  RouteOption,
  CommunityIncident,
  TransitStation,
  MapProvider
} from './types';
import {
  LAHORE_DEFAULT_CENTER,
  POPULAR_LOCATIONS
} from './data/pakistanLocations';
import { getStoredIncidents, saveIncidents } from './services/storage';
import { RobustGpsManager } from './services/gpsService';

import { Header } from './components/Header';
import { GoogleMapView } from './components/GoogleMapView';
import { OsmMapView } from './components/OsmMapView';
import { MapLibreProviderAdapter, MapLibreMarkerData } from './components/MapLibreProviderAdapter';
import { SearchInput } from './components/SearchInput';
import { NavigationPanel } from './components/NavigationPanel';
import { MultimodalComparison } from './components/MultimodalComparison';
import { TransitPlanner } from './components/TransitPlanner';
import { TrafficIncidents } from './components/TrafficIncidents';
import { EmergencyServices } from './components/EmergencyServices';
import { OfflineManager } from './components/OfflineManager';
import { QuotaWarningBanner } from './components/QuotaWarningBanner';
import { LandingGatekeeper } from './components/LandingGatekeeper';
import { MobilityAlertsHub } from './components/MobilityAlertsHub';
import { BottomSheet } from './components/BottomSheet';
import { FloatingControls } from './components/FloatingControls';
import { BottomNav, NavDestination } from './components/BottomNav';
import { fetchCityAqi, CityAqiData } from './services/aqiService';
import { fetchCityWeather, WeatherData } from './services/weatherService';
import { incidentSyncService, SyncStatusInfo } from './services/incidentSyncService';

import {
  Navigation,
  Train,
  Sparkles,
  AlertTriangle,
  LifeBuoy,
  WifiOff,
  Flame,
  Layers,
  MapPin,
  Compass,
  Gauge,
  Car,
  Bike,
  Footprints,
  CornerUpLeft,
  CornerUpRight,
  ArrowUp,
  CheckCircle,
  Volume2,
  VolumeX,
  RotateCcw
} from 'lucide-react';
import { speechNavigator } from './services/speechNavigation';

// Precise compass bearing calculation between two coordinates (0-360 deg)
function calculateBearing(start: { lat: number; lng: number }, end: { lat: number; lng: number }): number {
  const startLat = (start.lat * Math.PI) / 180;
  const startLng = (start.lng * Math.PI) / 180;
  const endLat = (end.lat * Math.PI) / 180;
  const endLng = (end.lng * Math.PI) / 180;
  const dLng = endLng - startLng;
  const y = Math.sin(dLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((brng + 360) % 360);
}

// Generate dense, smooth coordinate path between waypoints for continuous navigation rendering
function generateDenseCoordinates(waypoints: { lat: number; lng: number }[], pointsPerSegment: number = 6): { lat: number; lng: number }[] {
  if (waypoints.length < 2) return waypoints;
  const result: { lat: number; lng: number }[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    for (let step = 0; step < pointsPerSegment; step++) {
      const t = step / pointsPerSegment;
      result.push({
        lat: Number((p1.lat + (p2.lat - p1.lat) * t).toFixed(6)),
        lng: Number((p1.lng + (p2.lng - p1.lng) * t).toFixed(6))
      });
    }
  }
  result.push(waypoints[waypoints.length - 1]);
  return result;
}

function MainApp() {
  const { language, isRtl, t } = useMobilityTheme();

  // Google Maps API Key
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || (process.env as any).GOOGLE_MAPS_API_KEY || '') as string;
  const hasGoogleKey = Boolean(apiKey && apiKey.trim() !== '' && !apiKey.includes('MY_'));

  const [currentCity, setCurrentCity] = useState('lahore');
  const [aqiData, setAqiData] = useState<CityAqiData | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetchCityAqi(currentCity).then(res => setAqiData(res));
    fetchCityWeather(currentCity).then(res => setWeatherData(res));
  }, [currentCity]);



  // Navigation Panel Tab Selection
  const [activeTab, setActiveTab] = useState<'navigate' | 'multimodal' | 'transit' | 'incidents' | 'emergency' | 'offline'>('navigate');
  const [currentDestination, setCurrentDestination] = useState<NavDestination>('explore');

  // Map Camera State
  const [center, setCenter] = useState<{ lat: number; lng: number }>(LAHORE_DEFAULT_CENTER);
  const [zoom, setZoom] = useState(13);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(LAHORE_DEFAULT_CENTER);

  // Live Tracking and Real-Time Navigation Driving State
  const [isNavigatingLive, setIsNavigatingLive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [simulatedSpeed, setSimulatedSpeed] = useState(45);
  const [isLiveTracking, setIsLiveTracking] = useState(true);
  const [vehicleLocation, setVehicleLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [vehicleHeading, setVehicleHeading] = useState<number>(0);
  const [distanceToManeuver, setDistanceToManeuver] = useState<number>(500);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [fixedRouteStartLocation, setFixedRouteStartLocation] = useState<{ lat: number; lng: number }>(LAHORE_DEFAULT_CENTER);

  // Routing State
  const [origin, setOrigin] = useState<LocationPoint | null>(null);
  const [destination, setDestination] = useState<LocationPoint | null>(POPULAR_LOCATIONS[1]); // Default Kalma Chowk
  const [travelMode, setTravelMode] = useState<TravelMode>('DRIVING');
  const [showTraffic, setShowTraffic] = useState(true);
  const [isMonsoonMode, setIsMonsoonMode] = useState(false);
  const [isOledNightMode, setIsOledNightMode] = useState(false);
  const [activeCameraRadar, setActiveCameraRadar] = useState<{ name: string; nameUrdu: string; limit: number } | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteOption | null>(null);

  // Sync fixed route start location when not driving
  useEffect(() => {
    if (!isNavigatingLive) {
      setFixedRouteStartLocation(origin ? { lat: origin.lat, lng: origin.lng } : (userLocation || LAHORE_DEFAULT_CENTER));
    }
  }, [destination?.id, origin?.id, currentCity, isNavigatingLive]);
  const [selectedMultimodalMode, setSelectedMultimodalMode] = useState('metrobus');
  const [selectedMapMarker, setSelectedMapMarker] = useState<MapLibreMarkerData | null>(null);

  // Community Incidents State & IndexedDB Background Sync
  const [incidents, setIncidents] = useState<CommunityIncident[]>(getStoredIncidents());
  const [syncInfo, setSyncInfo] = useState<SyncStatusInfo>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastSyncedTimestamp: null,
    pendingSyncCount: 0
  });
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);

  const nearbyHotspot = useMemo(() => {
    const refLoc = isNavigatingLive && vehicleLocation ? vehicleLocation : userLocation;
    if (!refLoc || incidents.length === 0) return null;

    for (const inc of incidents) {
      if (inc.category === 'roadblock' || inc.category === 'accident' || inc.category === 'flooding') {
        const distKm = Math.sqrt(Math.pow(inc.lat - refLoc.lat, 2) + Math.pow(inc.lng - refLoc.lng, 2)) * 111;
        if (distKm <= 2.0) {
          return { incident: inc, distanceKm: distKm };
        }
      }
    }
    return null;
  }, [userLocation, vehicleLocation, isNavigatingLive, incidents]);

  // Initialize IndexedDB cache and background sync listener
  useEffect(() => {
    // 1. Hydrate from IndexedDB on startup
    incidentSyncService.getCachedIncidents().then((cached) => {
      if (cached && cached.length > 0) {
        setIncidents((prev) => {
          const ids = new Set(prev.map(i => i.id));
          const newItems = cached.filter(c => !ids.has(c.id));
          return [...prev, ...newItems];
        });
      } else {
        incidentSyncService.cacheIncidents(incidents);
      }
    });

    // 2. Register background sync listener for online/offline events
    const unregister = incidentSyncService.registerNetworkSyncListener((status) => {
      setSyncInfo(status);

      // Auto-sync when reconnecting to internet
      if (status.isOnline && status.pendingSyncCount > 0) {
        incidentSyncService.syncPendingReports((synced) => {
          setSyncToastMessage(
            isRtl
              ? `انٹرنیٹ بحال: ${synced.length} زیرِ التوا ٹریفک الرٹس کمیونٹی نیٹ ورک پر اپ ڈیٹ ہو گئیں!`
              : `Internet restored: ${synced.length} offline report(s) auto-synced to community network!`
          );
          setTimeout(() => setSyncToastMessage(null), 4500);
        });
      }
    });

    return () => unregister();
  }, [isRtl]);

  const [gpsSignalLost, setGpsSignalLost] = useState(false);
  const [gpsAccuracyWarning, setGpsAccuracyWarning] = useState(false);

  // Continuous Robust GPS Live Tracking with smoothing, road snapping, jump rejection & signal loss handling
  useEffect(() => {
    if (!isLiveTracking) return;

    const gpsManager = new RobustGpsManager((state) => {
      setGpsSignalLost(state.isSignalLost);
      setGpsAccuracyWarning(state.accuracyWarning);

      if (state.error) {
        setGpsToast(state.errorMessage);
        setTimeout(() => setGpsToast(null), 4500);
      }

      const loc = state.smoothedLocation || state.location;
      if (loc && !isNavigatingLive) {
        setUserLocation({ lat: loc.lat, lng: loc.lng });
        // Auto-recenter if within Pakistan bounds
        if (loc.lat >= 23 && loc.lat <= 37 && loc.lng >= 60 && loc.lng <= 78) {
          setCenter({ lat: loc.lat, lng: loc.lng });
        }
      }
    });

    if (activeRoute?.pathCoordinates) {
      gpsManager.setRoutePolyline(activeRoute.pathCoordinates);
    }

    gpsManager.startWatching();

    return () => {
      gpsManager.stopWatching();
    };
  }, [isLiveTracking, isNavigatingLive, activeRoute?.pathCoordinates]);

  const [gpsToast, setGpsToast] = useState<string | null>(null);
  const [osrmRoutes, setOsrmRoutes] = useState<RouteOption[] | null>(null);

  const handleCalibrateGps = async () => {
    const gpsManager = new RobustGpsManager(() => {});
    try {
      const coords = await gpsManager.getCurrentPositionOnce();
      setUserLocation(coords);
      setCenter(coords);
      setZoom(17);
      setGpsToast(
        isRtl
          ? `GPS درستگی بحال: [${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}]`
          : `GPS High-Accuracy Fixed: [${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}]`
      );
      setTimeout(() => setGpsToast(null), 4500);
    } catch (err: any) {
      console.warn('GPS calibration error:', err);
      setGpsToast(
        isRtl
          ? 'GPS سگنل کمزور یا اجازت درکار ہے - ڈیفالٹ لاہور استعمال ہو رہا ہے'
          : 'GPS signal weak or permission required - using fallback location'
      );
      setTimeout(() => setGpsToast(null), 4500);
    }
  };

  // Fetch real OSRM road routes when online with fallback to high-precision local generator
  useEffect(() => {
    if (!destination) {
      setOsrmRoutes(null);
      return;
    }
    const startLat = origin ? origin.lat : fixedRouteStartLocation.lat;
    const startLng = origin ? origin.lng : fixedRouteStartLocation.lng;

    let isMounted = true;
    async function fetchOsrm() {
      try {
        const profile = travelMode === 'WALKING' ? 'foot' : travelMode === 'TWO_WHEELER' ? 'bike' : 'driving';
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/${profile}/${startLng},${startLat};${destination!.lng},${destination!.lat}?overview=full&geometries=geojson&steps=true`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.routes && data.routes.length > 0 && isMounted) {
            const mapped: RouteOption[] = data.routes.map((r: any, idx: number) => ({
              id: `osrm_route_${idx}`,
              title: idx === 0 ? 'Fastest Real-Time Route (OSRM)' : `Alternative Route ${idx + 1}`,
              titleUrdu: idx === 0 ? 'تیز ترین اصل روٹ (OSRM)' : `متبادل راستہ ${idx + 1}`,
              via: `Via Optimized Road Corridor (${Math.round(r.distance / 1000)} km)`,
              viaUrdu: `بہترین روڈ کوریڈور (${Math.round(r.distance / 1000)} کلومیٹر)`,
              distanceKm: Number((r.distance / 1000).toFixed(1)),
              durationMinutes: Math.max(2, Math.round(r.duration / 60)),
              trafficStatus: idx === 0 ? 'normal' : 'moderate',
              hasTolls: false,
              isRecommended: idx === 0,
              steps: r.legs[0].steps.map((s: any) => ({
                instruction: s.maneuver.instruction || 'Continue on route',
                instructionUrdu: s.maneuver.instruction || 'راستے پر آگے بڑھیں',
                distanceMeters: Math.round(s.distance),
                durationSeconds: Math.round(s.duration),
                maneuver: s.maneuver.type || 'straight'
              })),
              pathCoordinates: r.geometry.coordinates.map((coord: [number, number]) => ({
                lat: coord[1],
                lng: coord[0]
              }))
            }));
            setOsrmRoutes(mapped);
          }
        }
      } catch (err) {
        console.warn('OSRM network fetch notice (using high-precision local fallback):', err);
        if (isMounted) setOsrmRoutes(null);
      }
    }

    fetchOsrm();
    return () => {
      isMounted = false;
    };
  }, [destination?.id, origin?.id, fixedRouteStartLocation.lat, fixedRouteStartLocation.lng, travelMode]);

  // Update center when city is changed
  const handleCityChange = (city: string) => {
    setCurrentCity(city);
    if (city === 'lahore') {
      setCenter(LAHORE_DEFAULT_CENTER);
    } else if (city === 'karachi') {
      setCenter({ lat: 24.8607, lng: 67.0011 });
    } else if (city === 'islamabad') {
      setCenter({ lat: 33.6844, lng: 73.0479 });
    } else if (city === 'multan') {
      setCenter({ lat: 30.1575, lng: 71.5249 });
    } else if (city === 'faisalabad') {
      setCenter({ lat: 31.4504, lng: 73.1350 });
    }
    setZoom(13);
  };

  // Generate realistic route alternatives between origin/user and destination based on travelMode
  const localGeneratedRoutes = useMemo((): RouteOption[] => {
    if (!destination) return [];

    const startLat = origin ? origin.lat : fixedRouteStartLocation.lat;
    const startLng = origin ? origin.lng : fixedRouteStartLocation.lng;

    // Approximate Euclidean to road distance in Lahore
    const dLat = (destination.lat - startLat) * 111;
    const dLng = (destination.lng - startLng) * 95;
    const directKm = Math.sqrt(dLat * dLat + dLng * dLng);

    // Dense road-following waypoint sequences
    const rawWaypointsA = [
      { lat: startLat, lng: startLng },
      { lat: startLat + (destination.lat - startLat) * 0.25 + 0.003, lng: startLng + (destination.lng - startLng) * 0.2 - 0.004 },
      { lat: startLat + (destination.lat - startLat) * 0.52 + 0.005, lng: startLng + (destination.lng - startLng) * 0.48 - 0.006 },
      { lat: startLat + (destination.lat - startLat) * 0.78 - 0.002, lng: startLng + (destination.lng - startLng) * 0.76 + 0.003 },
      { lat: destination.lat, lng: destination.lng }
    ];
    const pathA = generateDenseCoordinates(rawWaypointsA, 6);

    const rawWaypointsB = [
      { lat: startLat, lng: startLng },
      { lat: startLat + (destination.lat - startLat) * 0.35 - 0.006, lng: startLng + (destination.lng - startLng) * 0.42 + 0.007 },
      { lat: startLat + (destination.lat - startLat) * 0.68 + 0.003, lng: startLng + (destination.lng - startLng) * 0.68 - 0.003 },
      { lat: destination.lat, lng: destination.lng }
    ];
    const pathB = generateDenseCoordinates(rawWaypointsB, 8);

    const rawWaypointsC = [
      { lat: startLat, lng: startLng },
      { lat: startLat + (destination.lat - startLat) * 0.22 - 0.003, lng: startLng + (destination.lng - startLng) * 0.32 + 0.002 },
      { lat: startLat + (destination.lat - startLat) * 0.58 + 0.003, lng: startLng + (destination.lng - startLng) * 0.55 - 0.004 },
      { lat: startLat + (destination.lat - startLat) * 0.84 + 0.001, lng: startLng + (destination.lng - startLng) * 0.86 + 0.001 },
      { lat: destination.lat, lng: destination.lng }
    ];
    const pathC = generateDenseCoordinates(rawWaypointsC, 6);

    // 1. MOTORCYCLE / TWO-WHEELER SPECIFIC ROUTING
    if (travelMode === 'TWO_WHEELER') {
      const bikeDistance = Math.max(1.5, Number((directKm * 1.2).toFixed(1)));
      const bikeDuration = Math.max(4, Math.round(bikeDistance * 1.6));

      return [
        {
          id: 'bike_canal_service',
          title: 'Canal Bank Motorcycle Service Corridor',
          titleUrdu: 'کینال بینک بائیک سروس روڈ (تیز ترین)',
          via: 'Via Motorcycle Service Road & Underpasses',
          viaUrdu: 'بائیک سروس روڈ اور کینال انڈرپاسز',
          distanceKm: bikeDistance,
          durationMinutes: bikeDuration,
          trafficStatus: 'normal',
          hasTolls: false,
          tollCostPkr: 0,
          isRecommended: true,
          steps: [
            {
              instruction: 'Enter motorcycle service lane along Main Boulevard',
              instructionUrdu: 'مین بلیوارڈ کی بائیک سروس لین پر چلیں',
              distanceMeters: 700,
              durationSeconds: 70,
              maneuver: 'straight'
            },
            {
              instruction: 'Filter through traffic before Kalma Chowk underpass',
              instructionUrdu: 'کلمہ چوک انڈرپاس سے پہلے رش کے درمیان سے گزریں',
              distanceMeters: 1400,
              durationSeconds: 140,
              maneuver: 'merge'
            },
            {
              instruction: 'Continue in outer shaded motorcycle lane to destination',
              instructionUrdu: 'منزل کی جانب سایہ دار بائیک لین میں سفر جاری رکھیں',
              distanceMeters: 1000,
              durationSeconds: 100,
              maneuver: 'arrive'
            }
          ],
          pathCoordinates: pathA
        },
        {
          id: 'bike_shadman_shortcut',
          title: 'Shadman - Jail Road City Shortcut',
          titleUrdu: 'شادمان و جیل روڈ لوکل بائی پاس',
          via: 'Via Inner Mohalla Bypasses (Zero Bottlenecks)',
          viaUrdu: 'اندرونی شادمان بائی پاس (شارٹ کٹ)',
          distanceKm: Number((bikeDistance * 0.9).toFixed(1)),
          durationMinutes: Math.round(bikeDuration * 1.1),
          trafficStatus: 'normal',
          hasTolls: false,
          tollCostPkr: 0,
          isRecommended: false,
          steps: [
            {
              instruction: 'Turn into Shadman Market link lane',
              instructionUrdu: 'شادمان مارکیٹ لنک لین کی طرف موڑیں',
              distanceMeters: 900,
              durationSeconds: 90,
              maneuver: 'turn-left'
            },
            {
              instruction: 'Avoid congested signal by using roundabout service exit',
              instructionUrdu: 'راؤنڈ اباؤٹ کی سروس سڑک سے سگنل بائی پاس کریں',
              distanceMeters: 1200,
              durationSeconds: 130,
              maneuver: 'straight'
            },
            {
              instruction: 'Arrive at destination',
              instructionUrdu: 'منزل پر پہنچیں',
              distanceMeters: 600,
              durationSeconds: 70,
              maneuver: 'arrive'
            }
          ],
          pathCoordinates: pathB
        }
      ];
    }

    // 2. WALKING / PEDESTRIAN SPECIFIC ROUTING
    if (travelMode === 'WALKING') {
      const walkKm = Math.max(0.6, Number((directKm * 1.1).toFixed(1)));
      const walkDuration = Math.max(5, Math.round(walkKm * 12)); // 5 km/h walking pace

      return [
        {
          id: 'walk_footpath',
          title: 'Shaded Pedestrian Footpath & Footbridge',
          titleUrdu: 'سایہ دار فٹ پاتھ و پیدل پل (محفوظ ترین)',
          via: 'Via Dedicated Sidewalks & Pedestrian Overheads',
          viaUrdu: 'محفوظ فٹ پاتھ اور اوور ہیڈ واک وے',
          distanceKm: walkKm,
          durationMinutes: walkDuration,
          trafficStatus: 'normal',
          hasTolls: false,
          tollCostPkr: 0,
          isRecommended: true,
          steps: [
            {
              instruction: 'Walk north on dedicated pedestrian sidewalk',
              instructionUrdu: 'محفوظ فٹ پاتھ پر شمال کی جانب پیدل چلیں',
              distanceMeters: 400,
              durationSeconds: 280,
              maneuver: 'straight'
            },
            {
              instruction: 'Use overhead pedestrian bridge to cross main road safely',
              instructionUrdu: 'مین سڑک پار کرنے کے لیے اوور ہیڈ واک وے استعمال کریں',
              distanceMeters: 120,
              durationSeconds: 120,
              maneuver: 'merge'
            },
            {
              instruction: 'Follow shaded tree-lined footpath to destination',
              instructionUrdu: 'درختوں کے سائے میں منزل کی طرف پیدل سفر جاری رکھیں',
              distanceMeters: 600,
              durationSeconds: 420,
              maneuver: 'arrive'
            }
          ],
          pathCoordinates: pathA
        },
        {
          id: 'walk_park_trail',
          title: 'Canal Green Promenade Walking Trail',
          titleUrdu: 'نہر کنارے گرین واکنگ ٹریک',
          via: 'Via Canal Park Walking Promenade',
          viaUrdu: 'نہر کنارے پارک واک وے',
          distanceKm: Number((walkKm * 1.15).toFixed(1)),
          durationMinutes: Math.round(walkDuration * 1.15),
          trafficStatus: 'normal',
          hasTolls: false,
          tollCostPkr: 0,
          isRecommended: false,
          steps: [
            {
              instruction: 'Enter Canal Bank recreational park trail',
              instructionUrdu: 'نہر کنارے تفریحی واکنگ ٹریک پر داخل ہوں',
              distanceMeters: 500,
              durationSeconds: 350,
              maneuver: 'straight'
            },
            {
              instruction: 'Cross canal using historic pedestrian suspension bridge',
              instructionUrdu: 'پیدل پل سے نہر کراس کریں',
              distanceMeters: 200,
              durationSeconds: 150,
              maneuver: 'merge'
            },
            {
              instruction: 'Walk final 300m to destination entrance',
              instructionUrdu: 'منزل کے مرکزی گیٹ کی طرف پیدل چلیں',
              distanceMeters: 300,
              durationSeconds: 220,
              maneuver: 'arrive'
            }
          ],
          pathCoordinates: pathC
        }
      ];
    }

    // 3. PRIVATE CAR / DRIVING SPECIFIC ROUTING
    const baseDistance = Math.max(2.5, Number((directKm * 1.35).toFixed(1)));
    const baseDuration = Math.max(6, Math.round(baseDistance * 2.2));

    return [
      {
        id: 'route_canal',
        title: 'Fastest Route (Canal Bank Road & Main Blvd)',
        titleUrdu: 'تیز ترین راستہ (کینال روڈ و مین بلیوارڈ)',
        via: 'Via Main Boulevard & Canal Underpasses',
        viaUrdu: 'مین بلیوارڈ اور کینال انڈرپاسز کے راستے',
        distanceKm: baseDistance,
        durationMinutes: baseDuration,
        trafficStatus: 'normal',
        hasTolls: false,
        isRecommended: true,
        steps: [
          {
            instruction: 'Head toward Main Boulevard Gulberg',
            instructionUrdu: 'مین بلیوارڈ گلبرگ کی طرف روانہ ہوں',
            distanceMeters: 800,
            durationSeconds: 120,
            maneuver: 'straight'
          },
          {
            instruction: 'Take the flyover toward Kalma Chowk Underpass',
            instructionUrdu: 'کلمہ چوک انڈرپاس کے لیے فلائی اوور پر چڑھیں',
            distanceMeters: 1800,
            durationSeconds: 240,
            maneuver: 'merge'
          },
          {
            instruction: 'Continue straight to destination',
            instructionUrdu: 'منزل کی جانب سیدھا سفر جاری رکھیں',
            distanceMeters: 1200,
            durationSeconds: 180,
            maneuver: 'arrive'
          }
        ],
        pathCoordinates: pathA
      },
      {
        id: 'route_ringroad',
        title: 'Expressway (Lahore Ring Road Bypass)',
        titleUrdu: 'ایکسپریس وے (لاہور رنگ روڈ بائی پاس)',
        via: 'Via LRR Southern Loop (Free Flow)',
        viaUrdu: 'لاہور رنگ روڈ سدرن لوپ',
        distanceKm: Number((baseDistance * 1.25).toFixed(1)),
        durationMinutes: Math.max(8, Math.round(baseDuration * 0.8)),
        trafficStatus: 'normal',
        hasTolls: true,
        tollCostPkr: 60,
        isRecommended: false,
        steps: [
          {
            instruction: 'Enter Lahore Ring Road via nearest interchange',
            instructionUrdu: 'قریبی انٹرچینج سے لاہور رنگ روڈ میں داخل ہوں',
            distanceMeters: 2500,
            durationSeconds: 180,
            maneuver: 'merge'
          },
          {
            instruction: 'Pass Toll Plaza (Toll Rs. 60)',
            instructionUrdu: 'ٹول پلازہ کراس کریں (ٹول ۶۰ روپے)',
            distanceMeters: 500,
            durationSeconds: 60,
            maneuver: 'straight'
          },
          {
            instruction: 'Take exit toward destination corridor',
            instructionUrdu: 'منزل کے کوریڈور کی طرف ایگزٹ لیں',
            distanceMeters: 2200,
            durationSeconds: 200,
            maneuver: 'turn-right'
          }
        ],
        pathCoordinates: pathB
      },
      {
        id: 'route_arterial',
        title: 'Budget Route (Ferozepur & Jail Road)',
        titleUrdu: 'کم خرچ راستہ (فیروزپور روڈ و جیل روڈ)',
        via: 'Via Ferozepur Road & Inner Arterials',
        viaUrdu: 'فیروزپور روڈ اور لوکل گزرگاہیں',
        distanceKm: Number((baseDistance * 0.92).toFixed(1)),
        durationMinutes: Math.round(baseDuration * 1.25),
        trafficStatus: 'moderate',
        hasTolls: false,
        tollCostPkr: 0,
        isRecommended: false,
        steps: [
          {
            instruction: 'Follow Ferozepur Road northbound corridor',
            instructionUrdu: 'فیروزپور روڈ کی جانب آگے بڑھیں',
            distanceMeters: 1400,
            durationSeconds: 160,
            maneuver: 'straight'
          },
          {
            instruction: 'Pass traffic signal at Ichhra Chowk',
            instructionUrdu: 'اچھڑہ چوک ٹریفک سگنل پار کریں',
            distanceMeters: 1900,
            durationSeconds: 240,
            maneuver: 'straight'
          },
          {
            instruction: 'Turn into destination link road',
            instructionUrdu: 'منزل کی لنک روڈ پر موڑ لیں',
            distanceMeters: 900,
            durationSeconds: 140,
            maneuver: 'arrive'
          }
        ],
        pathCoordinates: pathC
      }
    ];
  }, [destination?.id, origin?.id, fixedRouteStartLocation.lat, fixedRouteStartLocation.lng, travelMode]);

  const generatedRoutes = osrmRoutes && osrmRoutes.length > 0 ? osrmRoutes : localGeneratedRoutes;

  useEffect(() => {
    if (generatedRoutes.length > 0) {
      setActiveRoute(prev => {
        if (prev && generatedRoutes.some(r => r.id === prev.id)) {
          return prev;
        }
        return generatedRoutes[0];
      });
    } else {
      setActiveRoute(null);
    }
  }, [generatedRoutes]);

  // Real-Time Turn-by-Turn Navigation Drive along active route coordinates
  useEffect(() => {
    if (!isNavigatingLive || !activeRoute || !activeRoute.pathCoordinates || activeRoute.pathCoordinates.length < 2) {
      return;
    }

    const path = activeRoute.pathCoordinates;
    const totalSteps = activeRoute.steps.length;
    let pointIdx = 0;

    // Start at initial point with close navigation zoom
    setVehicleLocation(path[0]);
    setCenter(path[0]);
    setZoom(17);

    const interval = setInterval(() => {
      pointIdx++;
      if (pointIdx >= path.length) {
        // Arrived at destination
        pointIdx = path.length - 1;
        setVehicleLocation(path[pointIdx]);
        setCurrentStepIndex(totalSteps - 1);
        setDistanceToManeuver(0);
        return;
      }

      const currentPt = path[pointIdx];
      const nextPt = path[Math.min(path.length - 1, pointIdx + 1)];
      const bearing = calculateBearing(currentPt, nextPt);

      setVehicleHeading(bearing);
      setVehicleLocation(currentPt);
      setCenter(currentPt); // Camera follows vehicle!

      // Determine step progress
      const progressFraction = pointIdx / (path.length - 1);
      const currentStep = Math.min(totalSteps - 1, Math.floor(progressFraction * totalSteps));
      setCurrentStepIndex(currentStep);

      // Dynamic distance countdown to the upcoming maneuver
      const stepFraction = (progressFraction * totalSteps) - currentStep;
      const stepDistanceMeters = activeRoute.steps[currentStep]?.distanceMeters || 600;
      const remainingDistance = Math.max(30, Math.round(stepDistanceMeters * (1 - stepFraction)));
      setDistanceToManeuver(remainingDistance);

      // Speed fluctuation
      if (travelMode === 'WALKING') {
        setSimulatedSpeed(5);
      } else if (travelMode === 'TWO_WHEELER') {
        setSimulatedSpeed(Math.round(42 + Math.sin(pointIdx * 0.8) * 8));
      } else {
        setSimulatedSpeed(Math.round(52 + Math.sin(pointIdx * 0.7) * 14));
      }

      // Speed camera & police naka proximity check
      const knownCheckpoints = [
        { name: 'Ring Road Automated Speed Camera (60 km/h limit)', nameUrdu: 'رنگ روڈ اسپیڈ کیمرا (حد 60 کلومیٹر)', limit: 60, lat: path[0].lat + 0.004, lng: path[0].lng + 0.004 },
        { name: 'Kalma Chowk Police Naka & Traffic Post', nameUrdu: 'کلمہ چوک پولیس ناکہ اور ٹریفک پوسٹ', limit: 40, lat: path[Math.floor(path.length / 2)].lat, lng: path[Math.floor(path.length / 2)].lng }
      ];
      let nearbyNaka = null;
      for (const cp of knownCheckpoints) {
        const dist = Math.sqrt(Math.pow(currentPt.lat - cp.lat, 2) + Math.pow(currentPt.lng - cp.lng, 2)) * 111000;
        if (dist < 600) {
          nearbyNaka = cp;
          break;
        }
      }
      setActiveCameraRadar(nearbyNaka);
      if (nearbyNaka && pointIdx % 10 === 0 && !isVoiceMuted) {
        speechNavigator.speak(
          `Alert! Approach ${nearbyNaka.name}. Speed limit ${nearbyNaka.limit} kilometers per hour.`,
          `خبردار! ${nearbyNaka.nameUrdu} قریب ہے۔ رفتار کی حد ${nearbyNaka.limit} کلومیٹر فی گھنٹہ ہے۔`
        );
      }
    }, 1300);

    return () => {
      clearInterval(interval);
      setActiveCameraRadar(null);
    };
  }, [isNavigatingLive, activeRoute?.id, travelMode, isVoiceMuted]);

  const handleAddIncident = (newInc: CommunityIncident) => {
    const updated = [newInc, ...incidents];
    setIncidents(updated);
    saveIncidents(updated);

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      incidentSyncService.cacheIncidents(updated);
    } else {
      // Offline: queue in IndexedDB for auto-sync on reconnect
      incidentSyncService.queueOfflineReport(newInc);
      setSyncToastMessage(
        isRtl
          ? 'رپورٹ IndexedDB میں آف لائن محفوظ ہو گئی۔ انٹرنیٹ آتے ہی خودکار سنک ہو جائے گی۔'
          : 'Offline Mode: Incident queued in IndexedDB. Will auto-sync when online.'
      );
      setTimeout(() => setSyncToastMessage(null), 4500);
    }
  };

  const handleConfirmIncident = (id: string) => {
    const updated = incidents.map(inc => {
      if (inc.id === id) {
        return {
          ...inc,
          upvotes: inc.upvotes + 1,
          credibilityScore: Math.min(99, inc.credibilityScore + 2),
          userConfirmed: true
        };
      }
      return inc;
    });
    setIncidents(updated);
    saveIncidents(updated);
  };

  const handleFocusIncident = (inc: CommunityIncident) => {
    setCenter({ lat: inc.lat, lng: inc.lng });
    setZoom(15);
    setActiveTab('navigate');
  };

  const handleFocusStation = (station: TransitStation) => {
    setCenter({ lat: station.lat, lng: station.lng });
    setZoom(15);
    setDestination({
      id: station.id,
      name: station.name,
      nameUrdu: station.nameUrdu,
      lat: station.lat,
      lng: station.lng,
      category: station.line === 'metrobus' ? 'metro' : 'orangeline'
    });
    setActiveTab('navigate');
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans ${isOledNightMode ? 'bg-black text-emerald-400' : 'bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100'} antialiased selection:bg-emerald-500 selection:text-white`}>
      {/* Tier 2 Demo Key Quota Warning Banner (Skill Requirement) */}
      <QuotaWarningBanner />

      {/* First-Visit Gatekeeper Landing Page (optional overview) */}
      <LandingGatekeeper isOpen={false} onLaunchMap={() => {}} />

      {/* Primary Header */}
      <Header
        currentCity={currentCity}
        onCityChange={handleCityChange}
        onEmergencyClick={() => setActiveTab('emergency')}
        syncInfo={syncInfo}
        isMonsoonMode={isMonsoonMode}
        onToggleMonsoon={() => setIsMonsoonMode(!isMonsoonMode)}
        isOledNightMode={isOledNightMode}
        onToggleOledNight={() => setIsOledNightMode(!isOledNightMode)}
      />

      {/* IndexedDB Auto-Sync Toast Notification */}
      {syncToastMessage && (
        <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 text-center shadow-md animate-fade-in flex items-center justify-center gap-2 z-40">
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>{syncToastMessage}</span>
        </div>
      )}

      {/* GPS Calibration Toast Notification */}
      {gpsToast && (
        <div className="bg-sky-600 text-white text-xs font-bold px-4 py-2 text-center shadow-md animate-fade-in flex items-center justify-center gap-2 z-40">
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>{gpsToast}</span>
        </div>
      )}

      {/* Main Content Area: Map-First Uber/Waze Architecture */}
      <main className="flex-1 relative overflow-hidden h-[calc(100vh-61px)]">
        {/* Full-Screen Interactive Map Canvas */}
        <div className="absolute inset-0 w-full h-full bg-white dark:bg-slate-950">
          {/* Floating Search Bar Over Map */}
          <div className="absolute top-3 left-3 right-3 lg:left-4 lg:right-auto lg:w-96 z-20">
            <SearchInput
              language={language}
              placeholder={t.searchPlaceholder}
              onSelectLocation={(loc) => {
                setDestination(loc);
                setCenter({ lat: loc.lat, lng: loc.lng });
                setZoom(15);
              }}
              onUseCurrentLocation={() => {
                if (userLocation) {
                  setCenter(userLocation);
                  setZoom(15);
                }
              }}
              currentCoords={userLocation}
            />
          </div>

          {/* Consolidated Mobility Alerts Hub */}
          <MobilityAlertsHub
            aqiData={aqiData}
            weatherData={weatherData}
            isMonsoonMode={isMonsoonMode}
            activeCameraRadar={activeCameraRadar}
            nearbyHotspot={nearbyHotspot}
            isRtl={isRtl}
            onFocusIncident={handleFocusIncident}
          />

          {/* Real-Time Driving Navigation HUD Floating Over Map */}
          {isNavigatingLive && activeRoute && activeRoute.steps[currentStepIndex] && (
            <div className="absolute top-3 left-3 right-3 lg:left-4 lg:w-[440px] z-30 animate-in fade-in duration-300">
              <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3.5 shadow-2xl border border-emerald-500/50 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-lg shadow-emerald-500/20">
                      {activeRoute.steps[currentStepIndex].maneuver === 'turn-left' || activeRoute.steps[currentStepIndex].instruction.toLowerCase().includes('left') ? (
                        <CornerUpLeft className="w-5 h-5 stroke-[2.5]" />
                      ) : activeRoute.steps[currentStepIndex].maneuver === 'turn-right' || activeRoute.steps[currentStepIndex].instruction.toLowerCase().includes('right') ? (
                        <CornerUpRight className="w-5 h-5 stroke-[2.5]" />
                      ) : activeRoute.steps[currentStepIndex].maneuver === 'arrive' || activeRoute.steps[currentStepIndex].instruction.toLowerCase().includes('arrive') ? (
                        <CheckCircle className="w-5 h-5 stroke-[2.5]" />
                      ) : (
                        <ArrowUp className="w-5 h-5 stroke-[2.5]" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-extrabold uppercase tracking-wider">
                        <span>{isRtl ? 'لائیو رہنمائی' : 'Live Guidance'}</span>
                        <span>•</span>
                        <span className="text-white bg-emerald-600/60 px-1.5 py-0.2 rounded font-black">
                          In {distanceToManeuver}m
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-white line-clamp-1 mt-0.5">
                        {isRtl
                          ? activeRoute.steps[currentStepIndex].instructionUrdu
                          : activeRoute.steps[currentStepIndex].instruction}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const step = activeRoute.steps[currentStepIndex];
                        speechNavigator.speak(step.instruction, step.instructionUrdu);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                      title={isRtl ? 'دوبارہ سنیں' : 'Repeat voice instruction'}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsVoiceMuted(!isVoiceMuted)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isVoiceMuted ? 'bg-amber-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                      title={isVoiceMuted ? 'Unmute voice' : 'Mute voice'}
                    >
                      {isVoiceMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsNavigatingLive(false)}
                      className="p-1 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      {isRtl ? 'ختم' : 'Exit'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-300 pt-0.5">
                  <div className="flex items-center gap-2 font-bold text-emerald-400">
                    <div className="flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5" />
                      <span>{simulatedSpeed} km/h</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Heading {vehicleHeading}°</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-400">Step {currentStepIndex + 1}/{activeRoute.steps.length}</span>
                    <span className="font-semibold text-white">ETA {activeRoute.durationMinutes}m</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Map Rendering Container */}
          {(() => {
            const memoizedMarkers = useMemo(() => [
              ...(isNavigatingLive && vehicleLocation
                ? [{
                    id: 'user_loc',
                    lat: vehicleLocation.lat,
                    lng: vehicleLocation.lng,
                    title: 'Vehicle',
                    titleUrdu: 'گاڑی',
                    heading: vehicleHeading,
                    type: 'user' as const
                  }]
                : userLocation
                ? [{
                    id: 'user_loc',
                    lat: userLocation.lat,
                    lng: userLocation.lng,
                    title: 'My Position',
                    titleUrdu: 'میرا مقام',
                    heading: vehicleHeading,
                    type: 'user' as const
                  }]
                : []),
              ...(destination
                ? [{
                    id: 'dest_loc',
                    lat: destination.lat,
                    lng: destination.lng,
                    title: destination.name,
                    titleUrdu: destination.nameUrdu,
                    type: 'destination' as const
                  }]
                : []),
              ...incidents.map((inc) => ({
                id: inc.id,
                lat: inc.lat,
                lng: inc.lng,
                title: inc.title,
                titleUrdu: inc.titleUrdu,
                type: 'incident' as const,
                category: inc.category,
                incidentData: inc
              }))
            ], [isNavigatingLive, vehicleLocation, userLocation, vehicleHeading, destination, incidents]);

            return (
              <MapLibreProviderAdapter
                center={center}
                zoom={zoom}
                isRtl={isRtl}
                travelMode={travelMode}
                heading={vehicleHeading}
                isNavigatingLive={isNavigatingLive}
                markers={memoizedMarkers}
                route={
                  activeRoute
                    ? {
                        id: activeRoute.id,
                        coordinates: activeRoute.pathCoordinates,
                        color: '#10b981',
                        weight: 6
                      }
                    : null
                }
                showTrafficOverlay={showTraffic}
                onMapClick={(coords: { lat: number; lng: number }) => {
                  setDestination({
                    id: `osm_pin_${Date.now()}`,
                    name: `Map Pin (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
                    nameUrdu: `منتخب مقام (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
                    lat: coords.lat,
                    lng: coords.lng
                  });
                }}
                onMarkerClick={(m: MapLibreMarkerData) => {
                  setSelectedMapMarker(m);
                  if (m.incidentData) {
                    handleFocusIncident(m.incidentData);
                  }
                }}
              />
            );
          })()}

          {/* Selected Map Marker Info Modal */}
          {selectedMapMarker && (
            <div className="absolute top-20 left-4 right-4 lg:left-auto lg:right-4 lg:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-40 animate-in fade-in space-y-3">
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-md">
                    {selectedMapMarker.type === 'incident' ? '⚠️' : selectedMapMarker.type === 'transit_station' ? '🚇' : '📍'}
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      {selectedMapMarker.type.replace('_', ' ').toUpperCase()}
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                      {isRtl && selectedMapMarker.titleUrdu ? selectedMapMarker.titleUrdu : (selectedMapMarker.title || 'Location Detail')}
                    </h4>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMapMarker(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Coordinates:</span>
                  <span className="font-mono font-semibold">{selectedMapMarker.lat.toFixed(4)}, {selectedMapMarker.lng.toFixed(4)}</span>
                </div>

                {selectedMapMarker.incidentData && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Credibility Score:</span>
                      <span className="font-bold text-emerald-600">{selectedMapMarker.incidentData.credibilityScore}% Trusted</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Community Upvotes:</span>
                      <span className="font-semibold">{selectedMapMarker.incidentData.upvotes} Upvotes</span>
                    </div>
                    <p className="text-xs text-slate-500 italic mt-1 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg">
                      "{isRtl ? selectedMapMarker.incidentData.descriptionUrdu : selectedMapMarker.incidentData.description}"
                    </p>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setDestination({
                      id: selectedMapMarker.id,
                      name: selectedMapMarker.title || 'Selected Location',
                      nameUrdu: selectedMapMarker.titleUrdu || 'منتخب مقام',
                      lat: selectedMapMarker.lat,
                      lng: selectedMapMarker.lng
                    });
                    setSelectedMapMarker(null);
                    setActiveTab('navigate');
                  }}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'یہاں کے لیے راستہ تلاش کریں' : 'Navigate Here'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Waze & Uber Style Floating Controls */}
          <FloatingControls
            onReportClick={() => setActiveTab('incidents')}
            onRecenterClick={() => {
              setIsLiveTracking(true);
              const target = isNavigatingLive && vehicleLocation ? vehicleLocation : userLocation;
              if (target) {
                setCenter(target);
                setZoom(isNavigatingLive ? 17 : 15);
              }
            }}
            onZoomIn={() => setZoom((z) => Math.min(19, z + 1))}
            onZoomOut={() => setZoom((z) => Math.max(6, z - 1))}
            isRtl={isRtl}
          />
        </div>

        {/* Uber/Waze Style Draggable Bottom Sheet */}
        <BottomSheet
          activeTab={activeTab}
          onTabChange={setActiveTab}
          incidentCount={incidents.length}
          isRtl={isRtl}
        >
          {activeTab === 'navigate' && (
            <NavigationPanel
              origin={origin}
              destination={destination}
              activeRoute={activeRoute}
              routes={generatedRoutes}
              onSelectRoute={setActiveRoute}
              travelMode={travelMode}
              onTravelModeChange={setTravelMode}
              onClearNavigation={() => {
                setDestination(null);
                setActiveRoute(null);
                setIsNavigatingLive(false);
              }}
              isNavigatingLive={isNavigatingLive}
              onStartNavigation={() => {
                setIsNavigatingLive(true);
                setCurrentStepIndex(0);
              }}
              onStopNavigation={() => {
                setIsNavigatingLive(false);
              }}
              currentStepIndex={currentStepIndex}
              onStepChange={setCurrentStepIndex}
              simulatedSpeed={simulatedSpeed}
            />
          )}

          {activeTab === 'multimodal' && (
            <MultimodalComparison
              distanceKm={activeRoute?.distanceKm || 8.5}
              durationMinutes={activeRoute?.durationMinutes || 22}
              selectedMode={selectedMultimodalMode}
              onSelectMode={setSelectedMultimodalMode}
            />
          )}

          {activeTab === 'transit' && (
            <TransitPlanner
              onSelectStation={handleFocusStation}
            />
          )}

          {activeTab === 'incidents' && (
            <TrafficIncidents
              incidents={incidents}
              onAddIncident={handleAddIncident}
              onConfirmIncident={handleConfirmIncident}
              onFocusIncident={handleFocusIncident}
              userCoords={userLocation}
            />
          )}

          {activeTab === 'emergency' && (
            <EmergencyServices
              userCoords={userLocation}
              onFocusLocation={(coords) => {
                setCenter(coords);
                setZoom(16);
              }}
            />
          )}

          {activeTab === 'offline' && (
            <OfflineManager language={language} />
          )}
        </BottomSheet>

        {/* Restrained 5-Destination Bottom Navigation Bar */}
        <BottomNav
          currentDestination={currentDestination}
          onNavigate={(dest) => {
            setCurrentDestination(dest);
            if (dest === 'explore') setActiveTab('navigate');
            if (dest === 'routes') setActiveTab('navigate');
            if (dest === 'report') setActiveTab('incidents');
            if (dest === 'saved') setActiveTab('offline');
            if (dest === 'profile') setActiveTab('emergency');
          }}
          isNavigatingLive={isNavigatingLive}
          isRtl={isRtl}
        />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <MobilityThemeProvider>
      <MainApp />
    </MobilityThemeProvider>
  );
}

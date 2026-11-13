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
  POPULAR_LOCATIONS,
  CITY_CENTERS
} from './data/pakistanLocations';
import { getStoredIncidents, saveIncidents } from './services/storage';
import { RobustGpsManager, calculateDistanceMeters } from './services/gpsService';
import { navigationEngineInstance } from './services/navigationEngine';

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

type RouteStep = RouteOption['steps'][number];

// Build readable instructions from OSRM maneuver data (OSRM does not return instruction text)
function osrmStep(s: any): RouteStep {
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
  // null until a real GPS fix arrives: never pretend the user is somewhere they are not
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const hasFixedOnceRef = React.useRef(false);

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
  const userFixKey = userLocation ? `${Math.round(userLocation.lat * 500)}_${Math.round(userLocation.lng * 500)}` : 'none';

  // Routing State
  const [originMode, setOriginMode] = useState<'current' | 'manual' | 'map'>('current');
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
      setFixedRouteStartLocation(origin ? { lat: origin.lat, lng: origin.lng } : (userLocation || CITY_CENTERS[currentCity] || LAHORE_DEFAULT_CENTER));
    }
  }, [destination?.id, origin?.id, currentCity, isNavigatingLive, userFixKey]);
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
        const distKm = calculateDistanceMeters(inc, refLoc) / 1000;
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
              ? `انٹرنیٹ بحال: ${synced.length} آف لائن رپورٹس اس ڈیوائس پر محفوظ ہیں۔`
              : `Back online: ${synced.length} offline report(s) are saved on this device.`
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
    if (!isLiveTracking && !isNavigatingLive) return;

    const gpsManager = new RobustGpsManager((state) => {
      setGpsSignalLost(state.isSignalLost);
      setGpsAccuracyWarning(state.accuracyWarning);

      if (state.error) {
        setGpsToast(state.errorMessage);
        setTimeout(() => setGpsToast(null), 4500);
      }

      const loc = state.smoothedLocation || state.location;
      if (loc) {
        setUserLocation({ lat: loc.lat, lng: loc.lng });

        if (isNavigatingLive) {
          setVehicleLocation({ lat: loc.lat, lng: loc.lng });
          if (loc.heading !== null && loc.heading !== undefined) {
            setVehicleHeading(loc.heading);
          }
          if (loc.speed !== null && loc.speed !== undefined) {
            setSimulatedSpeed(Math.max(0, Math.round(loc.speed * 3.6)));
          }
          setCenter({ lat: loc.lat, lng: loc.lng });
          setZoom(17);

          navigationEngineInstance.processPositionUpdate(loc);
        } else {
          // Centre on the first real fix only (never fight the user's panning); the Recenter button does the rest
          if (!hasFixedOnceRef.current && loc.lat >= 23 && loc.lat <= 37 && loc.lng >= 60 && loc.lng <= 78) {
            hasFixedOnceRef.current = true;
            setCenter({ lat: loc.lat, lng: loc.lng });
          }
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

  // Fetch real road routes (OSRM) when online; clear stale routes immediately when inputs change
  useEffect(() => {
    setOsrmRoutes(null);
    if (!destination) return;
    const startLat = origin ? origin.lat : fixedRouteStartLocation.lat;
    const startLng = origin ? origin.lng : fixedRouteStartLocation.lng;
    const dest = destination;
    const modeKey = travelMode;

    let isMounted = true;
    async function fetchOsrm() {
      try {
        // The public OSRM demo server only has a car profile; walking uses the FOSSGIS foot server
        const base = modeKey === 'WALKING'
          ? 'https://routing.openstreetmap.de/routed-foot/route/v1/driving'
          : 'https://router.project-osrm.org/route/v1/driving';
        const res = await fetch(
          `${base}/${startLng},${startLat};${dest.lng},${dest.lat}?overview=full&geometries=geojson&steps=true&alternatives=true`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted || !data?.routes?.length) return;
        const mapped: RouteOption[] = data.routes.slice(0, 3).map((r: any, idx: number) => {
          const km = Number((r.distance / 1000).toFixed(1));
          return {
            id: `osrm_${dest.id}_${modeKey}_${idx}`,
            title: idx === 0 ? 'Recommended route' : `Alternative route ${idx}`,
            titleUrdu: idx === 0 ? 'تجویز کردہ راستہ' : `متبادل راستہ ${idx}`,
            via: `Via road network (${km} km)`,
            viaUrdu: `سڑکوں کے نیٹ ورک کے ذریعے (${km} کلومیٹر)`,
            distanceKm: km,
            durationMinutes: Math.max(1, Math.round(r.duration / 60)),
            hasTolls: false,
            isRecommended: idx === 0,
            steps: r.legs[0].steps.map(osrmStep),
            pathCoordinates: r.geometry.coordinates.map((c: [number, number]) => ({ lat: c[1], lng: c[0] }))
          } as RouteOption;
        });
        setOsrmRoutes(mapped);
      } catch (err) {
        console.warn('Road routing unavailable, showing offline estimate:', err);
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
    const c = CITY_CENTERS[city];
    if (c) setCenter(c);
    // The previous destination belongs to the previous city
    if (city !== 'lahore') {
      setDestination(null);
      setActiveRoute(null);
    }
    setZoom(13);
  };

  // Offline fallback: a single, clearly-labelled straight-line estimate (no invented streets, tolls or traffic)
  const localGeneratedRoutes = useMemo((): RouteOption[] => {
    if (!destination) return [];
    const start = origin
      ? { lat: origin.lat, lng: origin.lng }
      : { lat: fixedRouteStartLocation.lat, lng: fixedRouteStartLocation.lng };
    const end = { lat: destination.lat, lng: destination.lng };
    const straightKm = calculateDistanceMeters(start, end) / 1000;
    const factor = travelMode === 'WALKING' ? 1.2 : 1.35; // typical road-vs-straight-line ratio
    const speedKmh = travelMode === 'WALKING' ? 5 : travelMode === 'TWO_WHEELER' ? 25 : 30;
    const km = Math.max(0.1, Number((straightKm * factor).toFixed(1)));
    const minutes = Math.max(1, Math.round((km / speedKmh) * 60));
    const path = Array.from({ length: 13 }, (_, i) => ({
      lat: start.lat + ((end.lat - start.lat) * i) / 12,
      lng: start.lng + ((end.lng - start.lng) * i) / 12
    }));
    const meters = Math.round(km * 1000);
    return [
      {
        id: `local_${destination.id}_${travelMode}`,
        title: 'Estimated route (offline)',
        titleUrdu: 'اندازہً راستہ (آف لائن)',
        via: 'Straight-line estimate, no road data. Connect to the internet for turn-by-turn routing',
        viaUrdu: 'سیدھی لکیر کا اندازہ، سڑک کا ڈیٹا دستیاب نہیں۔ درست رہنمائی کے لیے انٹرنیٹ سے جڑیں',
        distanceKm: km,
        durationMinutes: minutes,
        hasTolls: false,
        isRecommended: true,
        steps: [
          {
            instruction: 'Head toward your destination',
            instructionUrdu: 'اپنی منزل کی طرف روانہ ہوں',
            distanceMeters: Math.max(0, meters - 1),
            durationSeconds: Math.max(0, minutes * 60 - 1),
            maneuver: 'straight'
          },
          { instruction: 'Arrive at destination', instructionUrdu: 'منزل پر پہنچیں', distanceMeters: 1, durationSeconds: 1, maneuver: 'arrive' }
        ],
        pathCoordinates: path
      }
    ];
  }, [destination?.id, origin?.id, fixedRouteStartLocation.lat, fixedRouteStartLocation.lng, travelMode]);

  const generatedRoutes = osrmRoutes && osrmRoutes.length > 0 ? osrmRoutes : localGeneratedRoutes;

  useEffect(() => {
    if (generatedRoutes.length > 0) {
      setActiveRoute(prev => generatedRoutes.find(r => prev && r.id === prev.id) || generatedRoutes[0]);
    } else {
      setActiveRoute(null);
    }
  }, [generatedRoutes]);

  const handleRecenter = () => {
    const target = isNavigatingLive && vehicleLocation ? vehicleLocation : userLocation;
    if (target) {
      setCenter(target);
      setZoom(17);
    }
  };

  // Real-Time GPS-Driven Navigation State Machine & Maneuver Synchronization
  useEffect(() => {
    if (!isNavigatingLive || !activeRoute || !activeRoute.pathCoordinates || activeRoute.pathCoordinates.length < 2) {
      return;
    }

    const initialPos = userLocation || activeRoute.pathCoordinates[0];
    setVehicleLocation(initialPos);
    setCenter(initialPos);
    setZoom(17);

    navigationEngineInstance.startNavigation(activeRoute, destination!, origin, travelMode);

    const unsubscribe = navigationEngineInstance.subscribe((event) => {
      setCurrentStepIndex(event.currentStepIndex);
      setDistanceToManeuver(event.distanceToManeuver);
      if (event.state === 'ARRIVED') {
        setGpsToast(isRtl ? 'آپ اپنی منزل پر پہنچ گئے ہیں!' : 'You have arrived at your destination!');
        setTimeout(() => setGpsToast(null), 5000);
        setIsNavigatingLive(false);
      }
    });

    return () => {
      unsubscribe();
      navigationEngineInstance.stopNavigation();
      setActiveCameraRadar(null);
    };
  }, [isNavigatingLive, activeRoute?.id]);

  const mapRoute = useMemo(
    () => (activeRoute ? { id: activeRoute.id, coordinates: activeRoute.pathCoordinates, color: '#10b981', weight: 6 } : null),
    [activeRoute]
  );

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
          ? 'رپورٹ اس ڈیوائس پر محفوظ ہو گئی۔'
          : 'Offline: report saved on this device.'
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
    <div className={`h-screen w-screen flex flex-col font-sans ${isOledNightMode ? 'bg-black text-emerald-400' : 'bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100'} antialiased selection:bg-emerald-500 selection:text-white overflow-hidden`}>
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
      <main className="flex-1 relative overflow-hidden flex flex-col min-h-0 w-full">
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
                route={mapRoute}
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
              userLocation={userLocation}
              weatherData={weatherData}
              onRecenter={handleRecenter}
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
            if (dest === 'transit') setActiveTab('transit');
            if (dest === 'report') setActiveTab('incidents');
            if (dest === 'offline') setActiveTab('offline');
            if (dest === 'sos') setActiveTab('emergency');
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

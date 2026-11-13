/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MobilityThemeProvider, useMobilityTheme } from './components/ThemeLayoutWrapper';
import { CommunityIncident, TransitStation } from './types';
import { POPULAR_LOCATIONS, CITY_CENTERS } from './data/pakistanLocations';
import { getStoredIncidents, saveIncidents } from './services/storage';
import { RobustGpsManager } from './services/gpsService';
import { Header } from './components/Header';
import { MapLibreProviderAdapter, MapLibreMarkerData } from './components/MapLibreProviderAdapter';
import { SearchInput } from './components/SearchInput';
import { NavigationPanel } from './components/NavigationPanel';
import { NavHud } from './components/NavHud';
import { MultimodalComparison } from './components/MultimodalComparison';
import { TransitPlanner } from './components/TransitPlanner';
import { TrafficIncidents } from './components/TrafficIncidents';
import { EmergencyServices } from './components/EmergencyServices';
import { OfflineManager } from './components/OfflineManager';
import { QuotaWarningBanner } from './components/QuotaWarningBanner';
import { MobilityAlertsHub } from './components/MobilityAlertsHub';
import { BottomSheet } from './components/BottomSheet';
import { FloatingControls } from './components/FloatingControls';
import { BottomNav, NavDestination } from './components/BottomNav';
import { fetchCityAqi, CityAqiData } from './services/aqiService';
import { fetchCityWeather, WeatherData } from './services/weatherService';
import { incidentSyncService, SyncStatusInfo } from './services/incidentSyncService';
import { speechNavigator } from './services/speechNavigation';
import { fetchActiveIncidents, submitIncident, confirmIncident } from './services/incidentsApi';
import { haversineM } from './core/geo';
import { useAppStore, activeRouteOf } from './core/store';
import { useGpsTracking } from './hooks/useGpsTracking';
import { useRoutePlanner } from './hooks/useRoutePlanner';
import { useVoiceAnnouncer } from './hooks/useVoiceAnnouncer';
import { Navigation } from 'lucide-react';

function MainApp() {
  const { language, isRtl, t } = useMobilityTheme();

  // ---- Navigation state lives in the store (src/core); the UI only renders it ----
  const fix = useAppStore((s) => s.fix);
  const heading = useAppStore((s) => s.heading);
  const gpsError = useAppStore((s) => s.gps.error);
  const destination = useAppStore((s) => s.destination);
  const travelMode = useAppStore((s) => s.travelMode);
  const routes = useAppStore((s) => s.routes);
  const routesSource = useAppStore((s) => s.routesSource);
  const routesLoading = useAppStore((s) => s.routesLoading);
  const activeRoute = useAppStore(activeRouteOf);
  const session = useAppStore((s) => s.session);
  const rerouting = useAppStore((s) => s.rerouting);
  const voiceMuted = useAppStore((s) => s.voiceMuted);
  const store = useAppStore.getState;

  useGpsTracking(true);
  useRoutePlanner();
  useVoiceAnnouncer(language);

  // ---- View state ----
  const [currentCity, setCurrentCity] = useState('lahore');
  const [aqiData, setAqiData] = useState<CityAqiData | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [activeTab, setActiveTab] = useState<'navigate' | 'multimodal' | 'transit' | 'incidents' | 'emergency' | 'offline'>('navigate');
  const [currentDestination, setCurrentDestination] = useState<NavDestination>('explore');
  const [center, setCenter] = useState<{ lat: number; lng: number }>(CITY_CENTERS.lahore);
  const [zoom, setZoom] = useState(13);
  const [isMonsoonMode, setIsMonsoonMode] = useState(false);
  const [isOledNightMode, setIsOledNightMode] = useState(false);
  const [selectedMultimodalMode, setSelectedMultimodalMode] = useState('metrobus');
  const [selectedMapMarker, setSelectedMapMarker] = useState<MapLibreMarkerData | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<SyncStatusInfo>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastSyncedTimestamp: null,
    pendingSyncCount: 0
  });
  const [incidents, setIncidents] = useState<CommunityIncident[]>(getStoredIncidents());

  const flash = (msg: string, ms = 4500) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), ms);
  };

  useEffect(() => {
    fetchCityAqi(currentCity).then(setAqiData);
    fetchCityWeather(currentCity).then(setWeatherData);
  }, [currentCity]);

  // Centre the map on the first real fix only; afterwards the Recenter button / navigation follow mode does it
  const centredOnFix = useRef(false);
  useEffect(() => {
    if (!fix) return;
    if (session) {
      setCenter({ lat: fix.lat, lng: fix.lng });
      setZoom(17);
    } else if (!centredOnFix.current && fix.lat >= 23 && fix.lat <= 37 && fix.lng >= 60 && fix.lng <= 78) {
      centredOnFix.current = true;
      setCenter({ lat: fix.lat, lng: fix.lng });
    }
  }, [fix, session]);

  useEffect(() => {
    if (gpsError) flash(gpsError);
  }, [gpsError]);

  useEffect(() => {
    if (session?.status === 'arrived') {
      flash(isRtl ? 'آپ اپنی منزل پر پہنچ گئے ہیں!' : 'You have arrived at your destination!', 5000);
      const id = setTimeout(() => store().stopNavigation(), 4000);
      return () => clearTimeout(id);
    }
  }, [session?.status]);

  const nearbyHotspot = useMemo(() => {
    if (!fix) return null;
    for (const inc of incidents) {
      if (inc.category === 'roadblock' || inc.category === 'accident' || inc.category === 'flooding') {
        const distKm = haversineM(inc, fix) / 1000;
        if (distKm <= 2) return { incident: inc, distanceKm: distKm };
      }
    }
    return null;
  }, [fix, incidents]);

  // ---- Incidents: shared backend (Vercel function + Neon) when reachable, else device-local ----
  const [backendUp, setBackendUp] = useState(false);
  const backend = backendUp;
  const refreshRemote = () =>
    fetchActiveIncidents()
      .then((list) => { setBackendUp(true); setIncidents(list); })
      .catch(() => setBackendUp(false));
  useEffect(() => {
    void refreshRemote();
    // No realtime on Neon: poll while the tab is visible
    const id = setInterval(() => { if (document.visibilityState === 'visible') void refreshRemote(); }, 20_000);
    return () => clearInterval(id);
  }, []);

  // ---- Incidents: IndexedDB cache + offline queue ----
  useEffect(() => {
    incidentSyncService.getCachedIncidents().then((cached) => {
      setIncidents((prev) => {
        const ids = new Set(prev.map((i) => i.id));
        return [...prev, ...cached.filter((c) => !ids.has(c.id) && !c.id.startsWith('inc_'))];
      });
    });
    return incidentSyncService.registerNetworkSyncListener((status) => {
      setSyncInfo(status);
      if (status.isOnline && status.pendingSyncCount > 0) {
        incidentSyncService.syncPendingReports((synced) => {
          if (backend) {
            Promise.allSettled(synced.map((i) => submitIncident(i))).then((r) => {
              const ok = r.filter((x) => x.status === 'fulfilled').length;
              flash(isRtl ? `انٹرنیٹ بحال: ${ok} رپورٹس بھیج دی گئیں۔` : `Back online: ${ok} of ${synced.length} queued report(s) sent.`);
              void refreshRemote();
            });
          } else {
            flash(isRtl ? `انٹرنیٹ بحال: ${synced.length} آف لائن رپورٹس اس ڈیوائس پر محفوظ ہیں۔` : `Back online: ${synced.length} offline report(s) are saved on this device.`);
          }
        });
      }
    });
  }, [isRtl]);

  const handleCalibrateGps = async () => {
    try {
      const c = await new RobustGpsManager(() => {}).getCurrentPositionOnce();
      store().setFix(c);
      setCenter(c);
      setZoom(17);
    } catch {
      flash(isRtl ? 'GPS سگنل کمزور یا اجازت درکار ہے' : 'GPS signal weak or permission required');
    }
  };

  const handleCityChange = (city: string) => {
    setCurrentCity(city);
    const c = CITY_CENTERS[city];
    if (c) {
      setCenter(c);
      store().setCityCenter(c);
    }
    if (city !== 'lahore') store().setDestination(null); // the previous destination belongs to the previous city
    setZoom(13);
  };

  const handleRecenter = () => {
    const f = store().fix;
    if (f) {
      setCenter({ lat: f.lat, lng: f.lng });
      setZoom(session ? 17 : 15);
    } else {
      handleCalibrateGps();
    }
  };

  const handleStart = () => {
    const res = store().startNavigation();
    if (res.ok) {
      const f = store().fix!;
      setCenter({ lat: f.lat, lng: f.lng });
      setZoom(17);
    }
    return res;
  };

  const mapRoute = useMemo(
    () => (activeRoute ? { id: activeRoute.id, coordinates: activeRoute.pathCoordinates, color: '#10b981', weight: 6 } : null),
    [activeRoute]
  );

  const markers = useMemo<MapLibreMarkerData[]>(
    () => [
      ...(fix
        ? [{ id: 'user_loc', lat: fix.lat, lng: fix.lng, title: session ? 'Vehicle' : 'My Position', titleUrdu: session ? 'گاڑی' : 'میرا مقام', heading, type: 'user' as const }]
        : []),
      ...(destination
        ? [{ id: 'dest_loc', lat: destination.lat, lng: destination.lng, title: destination.name, titleUrdu: destination.nameUrdu, type: 'destination' as const }]
        : []),
      ...incidents.map((inc) => ({
        id: inc.id, lat: inc.lat, lng: inc.lng, title: inc.title, titleUrdu: inc.titleUrdu,
        type: 'incident' as const, category: inc.category, incidentData: inc
      }))
    ],
    [fix, heading, session, destination, incidents]
  );

  const handleAddIncident = (newInc: CommunityIncident) => {
    if (backend && navigator.onLine) {
      submitIncident(newInc)
        .then(() => refreshRemote())
        .catch((e) => flash(isRtl ? 'رپورٹ نہیں بھیجی جا سکی' : `Could not send report: ${e?.message ?? 'error'}`));
      return;
    }
    const updated = [newInc, ...incidents];
    setIncidents(updated);
    saveIncidents(updated);
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      incidentSyncService.cacheIncidents(updated);
    } else {
      incidentSyncService.queueOfflineReport(newInc);
      flash(isRtl ? 'رپورٹ اس ڈیوائس پر محفوظ ہو گئی۔' : 'Offline: report saved on this device.');
    }
  };

  const handleConfirmIncident = (id: string) => {
    if (backend) {
      confirmIncident(id).then(() => refreshRemote()).catch((e) => flash(e?.message ?? 'Could not confirm'));
      return;
    }
    const updated = incidents.map((inc) =>
      inc.id === id && !inc.userConfirmed
        ? { ...inc, upvotes: inc.upvotes + 1, credibilityScore: Math.min(99, inc.credibilityScore + 2), userConfirmed: true }
        : inc
    );
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
    store().setDestination({
      id: station.id, name: station.name, nameUrdu: station.nameUrdu ?? station.name, lat: station.lat, lng: station.lng,
      category: station.line === 'metrobus' ? 'metro' : 'orangeline'
    });
    setActiveTab('navigate');
  };

  return (
    <div className={`h-screen w-screen flex flex-col font-sans ${isOledNightMode ? 'bg-black text-emerald-400' : 'bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100'} antialiased selection:bg-emerald-500 selection:text-white overflow-hidden`}>
      {/* Tier 2 Demo Key Quota Warning Banner (Skill Requirement) */}
      <QuotaWarningBanner />

      
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

      {toast && (
        <div role="status" className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 text-center shadow-md flex items-center justify-center gap-2 z-40">
          <span>{toast}</span>
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
                store().setDestination(loc);
                setCenter({ lat: loc.lat, lng: loc.lng });
                setZoom(15);
              }}
              onUseCurrentLocation={handleRecenter}
              currentCoords={fix}
            />
          </div>

          {/* Consolidated Mobility Alerts Hub */}
          <MobilityAlertsHub
            aqiData={aqiData}
            weatherData={weatherData}
            isMonsoonMode={isMonsoonMode}
            nearbyHotspot={nearbyHotspot}
            isRtl={isRtl}
            onFocusIncident={handleFocusIncident}
          />

          {/* Turn-by-turn HUD */}
          {session && activeRoute && (
            <NavHud
              route={activeRoute}
              session={session}
              speedKmh={fix?.speed != null ? Math.max(0, Math.round(fix.speed * 3.6)) : null}
              muted={voiceMuted}
              rerouting={rerouting}
              isRtl={isRtl}
              onRepeat={() => {
                const st = activeRoute.steps[session.upcomingStepIndex];
                if (st) speechNavigator.speak(st.instruction, st.instructionUrdu, st.instructionUrdu, undefined, true);
              }}
              onToggleMute={() => store().toggleMute()}
              onExit={() => store().stopNavigation()}
            />
          )}

          <MapLibreProviderAdapter
            center={center}
            zoom={zoom}
            isRtl={isRtl}
            travelMode={travelMode}
            heading={heading}
            isNavigatingLive={session !== null}
            markers={markers}
            route={mapRoute}
            onMapClick={(coords: { lat: number; lng: number }) => {
              const n = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
              store().setDestination({
                id: `pin_${coords.lat.toFixed(5)}_${coords.lng.toFixed(5)}`,
                name: `Map Pin (${n})`,
                nameUrdu: `منتخب مقام (${n})`,
                lat: coords.lat,
                lng: coords.lng
              });
            }}
            onMarkerClick={(m: MapLibreMarkerData) => {
              setSelectedMapMarker(m);
              if (m.incidentData) handleFocusIncident(m.incidentData);
            }}
          />

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
                    store().setDestination({
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
            onRecenterClick={handleRecenter}
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
              destination={destination}
              activeRoute={activeRoute}
              routes={routes}
              routesLoading={routesLoading}
              routesSource={routesSource}
              onSelectRoute={(id) => store().selectRoute(id)}
              travelMode={travelMode}
              onTravelModeChange={(m) => store().setTravelMode(m)}
              onClearNavigation={() => store().setDestination(null)}
              session={session}
              hasFix={fix !== null}
              onStartNavigation={handleStart}
              onStopNavigation={() => store().stopNavigation()}
              weatherData={weatherData}
            />
          )}

          {activeTab === 'multimodal' && (
            activeRoute ? (
              <MultimodalComparison
                distanceKm={activeRoute.distanceKm}
                durationMinutes={activeRoute.durationMinutes}
                selectedMode={selectedMultimodalMode}
                onSelectMode={setSelectedMultimodalMode}
              />
            ) : (
              <p className="p-4 text-sm text-slate-500 dark:text-slate-400">
                {isRtl ? 'موازنہ دیکھنے کے لیے پہلے منزل منتخب کریں۔' : 'Pick a destination first to compare travel options for that trip.'}
              </p>
            )
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
              userCoords={fix}
            />
          )}

          {activeTab === 'emergency' && (
            <EmergencyServices
              userCoords={fix}
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
          isNavigatingLive={session !== null}
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

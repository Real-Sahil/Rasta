/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { MobilityThemeProvider, useMobilityTheme } from './components/ThemeLayoutWrapper';
import { CommunityIncident, TransitStation } from './types';
import { POPULAR_LOCATIONS, CITY_CENTERS, nearestCityId } from './data/pakistanLocations';
import { getStoredIncidents, saveIncidents } from './services/storage';
import { RobustGpsManager } from './services/gpsService';
import { Header } from './components/Header';
import { LegalModal, hasSeenNotice } from './components/LegalModal';
import type { MapLibreMarkerData } from './components/MapLibreProviderAdapter';
import { SearchInput } from './components/SearchInput';
import { NavigationPanel } from './components/NavigationPanel';
import { NavHud } from './components/NavHud';




import { QuotaWarningBanner } from './components/QuotaWarningBanner';
import { MobilityAlertsHub } from './components/MobilityAlertsHub';
import { BottomSheet, SheetSnap } from './components/BottomSheet';
import { FloatingControls } from './components/FloatingControls';
import { BottomNav, AppTab } from './components/BottomNav';
import { fetchCityAqi, CityAqiData } from './services/aqiService';
import { fetchCityWeather, WeatherData } from './services/weatherService';
import { incidentSyncService, SyncStatusInfo } from './services/incidentSyncService';
import { speechNavigator } from './services/speechNavigation';
import { stepAnnouncement } from './core/announcer';
import { fetchActiveIncidents, submitIncident, confirmIncident } from './services/incidentsApi';
import { haversineM } from './core/geo';
import { useAppStore, activeRouteOf } from './core/store';
import { useGpsTracking } from './hooks/useGpsTracking';
import { useRoutePlanner } from './hooks/useRoutePlanner';
import { useVoiceAnnouncer } from './hooks/useVoiceAnnouncer';
import { buildTripShareText } from './core/shareTrip';
import { Navigation, ArrowUpDown, X, MapPin } from 'lucide-react';

// Heavy, tab-specific UI is split out of the first load (the map engine alone is ~1 MB)
const MapLibreProviderAdapter = lazy(() => import('./components/MapLibreProviderAdapter').then((m) => ({ default: m.MapLibreProviderAdapter })));
const MultimodalComparison = lazy(() => import('./components/MultimodalComparison').then((m) => ({ default: m.MultimodalComparison })));
const TransitPlanner = lazy(() => import('./components/TransitPlanner').then((m) => ({ default: m.TransitPlanner })));
const TrafficIncidents = lazy(() => import('./components/TrafficIncidents').then((m) => ({ default: m.TrafficIncidents })));
const EmergencyServices = lazy(() => import('./components/EmergencyServices').then((m) => ({ default: m.EmergencyServices })));
const Loading = () => <div role="status" className="p-6 text-center text-sm text-slate-500">…</div>;

function MainApp() {
  const { language, isRtl, t } = useMobilityTheme();

  // ---- Navigation state lives in the store (src/core); the UI only renders it ----
  const fix = useAppStore((s) => s.fix);
  const heading = useAppStore((s) => s.heading);
  const gpsError = useAppStore((s) => s.gps.error);
  const destination = useAppStore((s) => s.destination);
  const origin = useAppStore((s) => s.origin);
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
  const voiceSupport = useVoiceAnnouncer(language);
  const voiceNotice = (() => {
    if (voiceSupport.hasRecordings || voiceSupport.status === 'ok') return null;
    if (voiceSupport.status === 'approximate') return isRtl ? 'پنجابی آواز دستیاب نہیں؛ اردو آواز استعمال ہو رہی ہے۔' : 'No Punjabi voice on this device: using an Urdu voice (pronunciation is approximate).';
    return language === 'ur' ? 'اس ڈیوائس پر اردو آواز موجود نہیں؛ ہدایات صرف اسکرین پر ہیں۔' : language === 'pa' ? 'اس ڈیوائس تے پنجابی یا اردو آواز نہیں؛ ہدایات صرف سکرین تے نے۔' : 'No voice available on this device: directions are shown on screen only.';
  })();

  // ---- View state ----
  const [currentCity, setCurrentCity] = useState('lahore');
  const [aqiData, setAqiData] = useState<CityAqiData | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('navigate');
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('peek');
  const [searching, setSearching] = useState(false); // suggestions open: the sheet steps aside so the map and list are visible
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

  const [firstRun, setFirstRun] = useState(() => !hasSeenNotice());
  const [legalOpen, setLegalOpen] = useState(() => !hasSeenNotice());
  const flash = (msg: string, ms = 4500) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), ms);
  };

  // Weather/AQI follow the nearest listed city on the first real fix, unless the user already picked one.
  const cityPicked = useRef(false);
  const hasFix = !!fix;
  useEffect(() => {
    if (!hasFix || cityPicked.current) return;
    cityPicked.current = true;
    const near = nearestCityId(store().fix);
    if (near) setCurrentCity(near);
  }, [hasFix]);

  useEffect(() => {
    fetchCityAqi(currentCity).then(setAqiData);
    fetchCityWeather(currentCity).then(setWeatherData);
  }, [currentCity]);

  // Centre the map on the first real fix only; afterwards the Recenter button / navigation follow mode does it
  const centredOnFix = useRef(false);
  useEffect(() => {
    if (!fix) return;
    if (session) {
      const p = session.snapped ?? fix;
      setCenter({ lat: p.lat, lng: p.lng });
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

  const floodLabels = useMemo(
    () => ({ layer: t.floodLayer, event1: t.floodEvent1, event2: t.floodEvent2, note: t.floodNote, credit: t.floodCredit }),
    [t.floodLayer, t.floodEvent1, t.floodEvent2, t.floodNote, t.floodCredit]
  );

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

  const openTab = (tab: AppTab) => {
    setActiveTab(tab);
    setSheetSnap((cur) => (cur === 'peek' ? 'half' : cur));
  };

  // Picking a destination brings up its route; starting a trip hides the sheet; leaving the trip restores it
  useEffect(() => {
    if (destination) {
      setActiveTab('navigate');
      setSheetSnap('half');
    }
  }, [destination?.id]);

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
    cityPicked.current = true;
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

  const handleShareTrip = async () => {
    const st = store();
    const pos = st.session?.snapped ?? st.fix;
    if (!pos || !st.destination) return;
    const text = buildTripShareText(t.shareTripMsg, { dest: isRtl ? st.destination.nameUrdu : st.destination.name, remainingS: st.session?.remainingS ?? 0, pos });
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); flash(t.shareCopied); }
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') { try { await navigator.clipboard.writeText(text); flash(t.shareCopied); } catch { /* nothing more to try */ } }
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

  const sheetTitle = {
      navigate: destination ? (isRtl ? 'راستہ' : 'Route') : (isRtl ? 'منزل منتخب کریں' : 'Choose a destination'),
      multimodal: isRtl ? 'سفر کے طریقوں کا موازنہ' : 'Compare ways to travel',
      transit: isRtl ? 'لاہور میٹرو بس اور اورنج لائن' : 'Lahore Metrobus & Orange Line',
      incidents: isRtl ? `سڑک کی رپورٹس (${incidents.length})` : `Road reports (${incidents.length})`,
      emergency: isRtl ? 'ایمرجنسی مدد' : 'Emergency help'
    }[activeTab];

  const mapRoute = useMemo(
    () => (activeRoute ? { id: activeRoute.id, coordinates: activeRoute.pathCoordinates, color: '#10b981', weight: 6 } : null),
    [activeRoute]
  );

  // While on the route the vehicle is drawn on the road line, not at the raw (noisy) GPS point
  const vehiclePos = fix ? (session?.snapped ?? fix) : null;
  const markers = useMemo<MapLibreMarkerData[]>(
    () => [
      ...(vehiclePos
        ? [{ id: 'user_loc', lat: vehiclePos.lat, lng: vehiclePos.lng, title: session ? 'Vehicle' : 'My Position', titleUrdu: session ? 'گاڑی' : 'میرا مقام', heading, type: 'user' as const }]
        : []),
      ...(destination
        ? [{ id: 'dest_loc', lat: destination.lat, lng: destination.lng, title: destination.name, titleUrdu: destination.nameUrdu, type: 'destination' as const }]
        : []),
      ...incidents.map((inc) => ({
        id: inc.id, lat: inc.lat, lng: inc.lng, title: inc.title, titleUrdu: inc.titleUrdu,
        type: 'incident' as const, category: inc.category, incidentData: inc
      }))
    ],
    [vehiclePos?.lat, vehiclePos?.lng, heading, session !== null, destination, incidents]
  );

  const handleAddIncident = (newInc: CommunityIncident) => {
    if (backend && navigator.onLine) {
      submitIncident(newInc)
        .then(() => refreshRemote())
        .catch((e) => {
          const code = e?.code as string | undefined;
          if (code === 'duplicate_report') flash(isRtl ? 'اسی مقام پر ایسی رپورٹ پہلے سے موجود ہے۔ اسے تصدیق کر دیں۔' : 'A similar report already exists here. Confirm it instead.', 6000);
          else if (code === 'rate_limited') flash(isRtl ? 'بہت زیادہ رپورٹس۔ کچھ دیر بعد کوشش کریں۔' : 'Too many reports from this device. Please try again later.', 6000);
          else flash(isRtl ? 'رپورٹ نہیں بھیجی جا سکی' : 'Could not send the report. Please try again.');
        });
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
  };

  const handleFocusStation = (station: TransitStation) => {
    setCenter({ lat: station.lat, lng: station.lng });
    setZoom(15);
    store().setDestination({
      id: station.id, name: station.name, nameUrdu: station.nameUrdu ?? station.name, lat: station.lat, lng: station.lng,
      category: station.line === 'orangeline' ? 'orangeline' : 'metro'
    });
    openTab('navigate');
  };

  return (
    <div className={`h-screen w-screen flex flex-col font-sans ${isOledNightMode ? 'bg-black text-emerald-400' : 'bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100'} antialiased selection:bg-emerald-500 selection:text-white overflow-hidden`}>
      {/* Tier 2 Demo Key Quota Warning Banner (Skill Requirement) */}
      <QuotaWarningBanner />

      
      {/* Primary Header */}
      <Header
        currentCity={currentCity}
        onCityChange={handleCityChange}
        onEmergencyClick={() => openTab('emergency')}
        syncInfo={syncInfo}
        isMonsoonMode={isMonsoonMode}
        onToggleMonsoon={() => setIsMonsoonMode(!isMonsoonMode)}
        isOledNightMode={isOledNightMode}
        onToggleOledNight={() => setIsOledNightMode(!isOledNightMode)}
        onLegalClick={() => setLegalOpen(true)}
      />
      <LegalModal open={legalOpen} firstRun={firstRun} onClose={() => { setLegalOpen(false); setFirstRun(false); }} />

      {!syncInfo.isOnline && (
        <div role="status" className="bg-amber-500 text-slate-950 text-xs font-bold px-4 py-1.5 text-center z-40">
          {isRtl ? 'آپ آف لائن ہیں: تلاش اور راستے کے لیے انٹرنیٹ درکار ہے۔' : 'You are offline: search and routing need a connection. Areas you have already viewed may still show.'}
        </div>
      )}

      {toast && (
        <div role="status" className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 text-center shadow-md flex items-center justify-center gap-2 z-40">
          <span>{toast}</span>
        </div>
      )}

      {/* Main Content Area: Map-First Uber/Waze Architecture */}
      <main className="flex-1 relative overflow-hidden flex flex-col min-h-0 w-full">
        {/* Full-Screen Interactive Map Canvas */}
        <div className="absolute inset-0 w-full h-full bg-white dark:bg-slate-950">
          {/* Floating search: one "where to" bar, which becomes a From / To panel once a destination is chosen */}
          <div className="absolute top-3 left-3 right-3 lg:left-4 lg:right-auto lg:w-96 z-20">
            {!destination ? (
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
                onOpenChange={setSearching}
              />
            ) : (
              <div className="flex items-stretch gap-1.5">
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="relative z-50">
                    <SearchInput
                      compact
                      language={language}
                      placeholder={t.fromPlaceholder}
                      externalLabel={origin ? (isRtl ? origin.nameUrdu : origin.name) : t.yourLocation}
                      leadingIcon={<span className="w-3 h-3 rounded-full border-[3px] border-sky-600 bg-white" />}
                      currentLocationLabel={t.yourLocation}
                      onUseCurrentLocation={() => store().setOrigin(null)}
                      onSelectLocation={(loc) => { store().setOrigin(loc); setCenter({ lat: loc.lat, lng: loc.lng }); }}
                      currentCoords={fix}
                      onOpenChange={setSearching}
                    />
                  </div>
                  <div className="relative z-40">
                    <SearchInput
                      compact
                      language={language}
                      placeholder={t.toPlaceholder}
                      externalLabel={isRtl ? destination.nameUrdu : destination.name}
                      leadingIcon={<MapPin className="w-4 h-4 text-rose-600" />}
                      onSelectLocation={(loc) => { store().setDestination(loc); setCenter({ lat: loc.lat, lng: loc.lng }); setZoom(15); }}
                      currentCoords={fix}
                      onOpenChange={setSearching}
                    />
                  </div>
                </div>
                <div className="flex flex-col justify-between gap-1.5">
                  <button
                    type="button"
                    title={t.clearRoute}
                    aria-label={t.clearRoute}
                    onClick={() => { store().setOrigin(null); store().setDestination(null); }}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 shadow-lg border border-slate-200/80 dark:border-slate-800 text-slate-500 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title={t.swapPoints}
                    aria-label={t.swapPoints}
                    disabled={!origin && !fix}
                    onClick={() => {
                      const here = fix ? { id: 'me', name: t.yourLocation, nameUrdu: t.yourLocation, lat: fix.lat, lng: fix.lng } : null;
                      const from = origin ?? here;
                      const to = destination;
                      if (!from) return;
                      // the old destination becomes the start; the old start (or my position) becomes the destination
                      store().setDestination(from);
                      store().setOrigin(to);
                    }}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 shadow-lg border border-slate-200/80 dark:border-slate-800 text-slate-600 disabled:opacity-40 cursor-pointer"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
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
              voiceNotice={voiceNotice}
              isRtl={isRtl}
              onRepeat={() => {
                const st = activeRoute.steps[session.upcomingStepIndex];
                if (st) speechNavigator.speakAnnouncement(stepAnnouncement(`${activeRoute.id}:repeat:${Date.now()}`, st, session.distanceToManeuverM <= 50 ? null : (session.distanceToManeuverM > 350 ? 500 : 200)), true);
              }}
              onToggleMute={() => store().toggleMute()}
              onExit={() => store().stopNavigation()}
              onShare={() => void handleShareTrip()}
            />
          )}

          <Suspense fallback={<Loading />}>
          <MapLibreProviderAdapter
            center={center}
            zoom={zoom}
            isRtl={isRtl}
            travelMode={travelMode}
            heading={heading}
            isNavigatingLive={session !== null}
            markers={markers}
            route={mapRoute}
            floodLabels={floodLabels}
            recenterLabel={t.recenter}
            controlsTopPx={destination ? 128 : 72}
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
          </Suspense>

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

        </div>

        <BottomSheet
          title={sheetTitle}
          snap={sheetSnap}
          onSnapChange={setSheetSnap}
          hidden={session !== null}
          tucked={searching}
          isRtl={isRtl}
          floating={
            <FloatingControls
              onReportClick={session ? undefined : () => openTab('incidents')}
              onLocateClick={handleRecenter}
              isRtl={isRtl}
            />
          }
          footer={
            activeTab === 'navigate' && destination && !session ? (
              <button
                type="button"
                disabled={!activeRoute || routesLoading}
                onClick={() => {
                  const res = handleStart();
                  if (!res.ok) flash(res.reason === 'custom_origin' ? t.previewOnly : res.reason === 'no_fix' ? (isRtl ? 'GPS لوکیشن دستیاب نہیں۔ براہ کرم مقام کی اجازت دیں اور دوبارہ کوشش کریں۔' : 'No GPS fix yet. Allow location access and try again.') : (isRtl ? 'ابھی کوئی راستہ دستیاب نہیں۔' : 'No route available yet.'));
                }}
                className="skin-primary w-full py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black text-base flex items-center justify-center gap-2 cursor-pointer transition-[transform,background-color] duration-150 active:scale-[0.98] disabled:active:scale-100"
              >
                <Navigation className="w-5 h-5" />
                <span>{isRtl ? 'نیویگیشن شروع کریں' : 'Start navigation'}</span>
              </button>
            ) : null
          }
        >
          {/* Keyed by tab, so each tab's content rises in when it opens (CSS only, see Motion in index.css). */}
          <div key={activeTab} className="animate-in space-y-4">
          {activeTab === 'navigate' && !destination && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{isRtl ? 'کہاں جانا ہے؟' : 'Where to?'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{isRtl ? 'اوپر تلاش کریں، نقشے پر ٹیپ کریں، یا یہاں سے منتخب کریں:' : 'Search above, tap the map, or pick a popular place:'}</p>
              <div className="flex flex-wrap gap-2">
                {POPULAR_LOCATIONS.slice(0, 6).map((loc) => (
                  <button key={loc.id} type="button" onClick={() => { store().setDestination(loc); setCenter({ lat: loc.lat, lng: loc.lng }); setZoom(14); }} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-emerald-100 dark:hover:bg-emerald-950 cursor-pointer">
                    {isRtl ? loc.nameUrdu : loc.name.split(',')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'navigate' && destination && (
            <NavigationPanel
              destination={destination}
              activeRoute={activeRoute}
              routes={routes}
              routesLoading={routesLoading}
              routesSource={routesSource}
              onSelectRoute={(id) => store().selectRoute(id)}
              travelMode={travelMode}
              onTravelModeChange={(m) => store().setTravelMode(m)}
              onClearNavigation={() => { store().setOrigin(null); store().setDestination(null); }}
              hasFix={fix !== null}
              originName={origin ? (isRtl ? origin.nameUrdu : origin.name) : undefined}
              weatherData={weatherData}
            />
          )}

          <Suspense fallback={<Loading />}>
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
              city={currentCity}
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
          </Suspense>
          </div>
        </BottomSheet>

        <BottomNav active={activeTab} onChange={openTab} hidden={session !== null} isRtl={isRtl} />
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

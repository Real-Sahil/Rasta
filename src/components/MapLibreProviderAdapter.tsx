/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { CommunityIncident, TravelMode } from '../types';
import { Layers, Navigation, Plus, Minus, Compass, AlertTriangle, Droplets, Construction, ShieldAlert, Flame } from 'lucide-react';
import { OsmMapView } from './OsmMapView';
import { escapeHtml } from '../services/escapeHtml';

// Explicitly register worker URL so MapLibre GL never fails to spawn workers inside iframe sandboxes
try {
  if (typeof (maplibregl as any).setWorkerUrl === 'function') {
    (maplibregl as any).setWorkerUrl(maplibreWorkerUrl);
  }
} catch (err) {
  console.warn('Unable to set MapLibre workerUrl:', err);
}

export interface MapLibreMarkerData {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  titleUrdu?: string;
  type: 'user' | 'origin' | 'destination' | 'incident' | 'transit_station';
  category?: string;
  incidentData?: CommunityIncident;
  heading?: number;
}

export interface MapLibreRouteData {
  id: string;
  coordinates: { lat: number; lng: number }[];
  color?: string;
  weight?: number;
}

export interface MapLibreProviderAdapterProps {
  center: { lat: number; lng: number };
  zoom: number;
  isRtl?: boolean;
  markers?: MapLibreMarkerData[];
  route?: MapLibreRouteData | null;
  travelMode?: TravelMode;
  showTrafficOverlay?: boolean;
  isNavigatingLive?: boolean;
  heading?: number;
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  onMarkerClick?: (marker: MapLibreMarkerData) => void;
  className?: string;
  /** Translated strings for the past-flooding layer (the layer is hidden when omitted). */
  floodLabels?: FloodLabels;
  recenterLabel?: string;
  /** Distance (px) of the map controls from the top, to clear the search / From-To panel. */
  controlsTopPx?: number;
}

export interface FloodLabels {
  layer: string;
  event1: string;
  event2: string;
  note: string;
  credit: string;
}

interface FloodEvent { id: string; title: string; datasetDate: string | null; polygons: number[][][][] }
const FLOOD_COLOURS = ['#2563eb', '#7c3aed'];

// OpenFreeMap vector styles (no key, no watermark, OpenStreetMap data)
const OPENFREEMAP_LIBERTY_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const OPENFREEMAP_BRIGHT_STYLE = 'https://tiles.openfreemap.org/styles/bright';
const OPENFREEMAP_POSITRON_STYLE = 'https://tiles.openfreemap.org/styles/positron'; // light, low-glare

type StyleMode = 'liberty' | 'bright' | 'positron';
const STYLE_MODES: StyleMode[] = ['liberty', 'bright', 'positron'];

export const MapLibreProviderAdapter: React.FC<MapLibreProviderAdapterProps> = ({
  center,
  zoom,
  isRtl = false,
  markers = [],
  route = null,
  travelMode = 'DRIVING',
  showTrafficOverlay = false,
  isNavigatingLive = false,
  heading = 0,
  onMapClick,
  onMarkerClick,
  className = '',
  floodLabels,
  recenterLabel = 'Re-centre',
  controlsTopPx = 72
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});
  const [styleMode, setStyleMode] = useState<StyleMode>('liberty');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [styleVersion, setStyleVersion] = useState(0);
  const [mapSlow, setMapSlow] = useState(false);
  // Free-look: while driving, a drag/zoom by the user pauses camera-follow until they tap Re-centre (or 10 s pass)
  const [freeLook, setFreeLook] = useState(false);
  const freeLookTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fittedRouteRef = useRef<string | null>(null);
  const [webGlSupported, setWebGlSupported] = useState(true);

  // Layer Control Toggles
  const [showIncidentsLayer, setShowIncidentsLayer] = useState(true);
  const [showTransitLayer, setShowTransitLayer] = useState(true);
  const [showRouteLayer, setShowRouteLayer] = useState(true);
  const [showHeatmapLayer, setShowHeatmapLayer] = useState(true);
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [showFloodLayer, setShowFloodLayer] = useState(false);
  const [floodEvents, setFloodEvents] = useState<FloodEvent[] | null>(null);

  const filteredMarkers = markers.filter((m) => {
    if (m.type === 'incident' && !showIncidentsLayer) return false;
    if (m.type === 'transit_station' && !showTransitLayer) return false;
    return true;
  });

  const getStyleSpec = (mode: StyleMode) => {
    switch (mode) {
      case 'bright':
        return OPENFREEMAP_BRIGHT_STYLE;
      case 'positron':
        return OPENFREEMAP_POSITRON_STYLE;
      case 'liberty':
      default:
        return OPENFREEMAP_LIBERTY_STYLE;
    }
  };

  // Check WebGL support on initial mount
  useEffect(() => {
    setWebGlSupported(true);
  }, []);

  // Initialize MapLibre GL Map
  useEffect(() => {
    if (!containerRef.current || !webGlSupported) return;

    const initialStyle = getStyleSpec(styleMode);

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: initialStyle,
        center: [center.lng, center.lat],
        zoom: zoom,
        attributionControl: false
      });
    } catch (err) {
      console.warn('MapLibre GL failed to construct, falling back to OSM Slippy canvas:', err);
      setWebGlSupported(false);
      return;
    }

    // setStyle() wipes custom sources/layers, so re-add the route every time a style finishes loading
    map.on('style.load', () => setStyleVersion((v) => v + 1));

    // If the basemap hasn't rendered after 10 s, tell the user instead of showing a blank map
    const slowTimer = setTimeout(() => setMapSlow(true), 10_000);
    map.on('load', () => {
      clearTimeout(slowTimer);
      setMapSlow(false);
      setMapLoaded(true);
      map.resize();
    });

    // If the default style can't be fetched, try the simpler Bright style once; the slow-map notice covers a full outage
    map.on('error', (e) => {
      console.warn('MapLibre error event:', e);
      if (styleMode === 'liberty') {
        try {
          map.setStyle(OPENFREEMAP_BRIGHT_STYLE);
          setStyleMode('bright');
        } catch {}
      }
    });

    const onUserMove = (e: { originalEvent?: unknown }) => {
      if (!e.originalEvent) return; // programmatic camera moves don't count
      setFreeLook(true);
      if (freeLookTimer.current) clearTimeout(freeLookTimer.current);
      freeLookTimer.current = setTimeout(() => setFreeLook(false), 10_000);
    };
    map.on('dragstart', onUserMove);
    map.on('zoomstart', onUserMove);

    map.on('click', (e) => {
      if (onMapClick) {
        onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });

    // Handle container dimension changes to guarantee tiles never gray out
    const resizeObserver = new ResizeObserver(() => {
      if (map) {
        map.resize();
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Force periodic resize checks on initial mount to counter flexbox zero-height delays
    const timer1 = setTimeout(() => map.resize(), 150);
    const timer2 = setTimeout(() => map.resize(), 600);

    mapRef.current = map;

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(slowTimer);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, [webGlSupported]);

  // Update camera smoothly when center, heading, or navigation state changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (isNavigatingLive && freeLook) return; // the user is looking around; don't fight them
    if (isNavigatingLive) {
      // 3D Cockpit / Driver POV Navigation Mode
      map.easeTo({
        center: [center.lng, center.lat],
        zoom: zoom || 17,
        bearing: heading || 0,
        pitch: 45,
        // push the vehicle towards the bottom so the road ahead fills the screen
        padding: { top: Math.round(map.getContainer().clientHeight * 0.4), bottom: 0, left: 0, right: 0 },
        duration: 900,
        essential: true
      });
    } else {
      map.flyTo({
        center: [center.lng, center.lat],
        zoom: zoom,
        bearing: 0,
        pitch: 0,
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
        essential: true,
        duration: 700
      });
    }
  }, [center.lat, center.lng, zoom, isNavigatingLive, heading, freeLook]);

  // Leaving navigation ends free-look; clear the timer on unmount
  useEffect(() => { if (!isNavigatingLive) setFreeLook(false); }, [isNavigatingLive]);
  useEffect(() => () => { if (freeLookTimer.current) clearTimeout(freeLookTimer.current); }, []);

  // Update Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear obsolete markers
    const keyOf = (m: MapLibreMarkerData) =>
      m.type === 'user' ? m.id : `${m.id}|${m.title ?? ''}|${m.incidentData?.upvotes ?? ''}|${isRtl ? 'r' : 'l'}`;
    const currentMarkerIds = new Set(filteredMarkers.map(keyOf));
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentMarkerIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Render / update markers
    filteredMarkers.forEach((markerData) => {
      const mKey = keyOf(markerData);
      let existingMarker = markersRef.current[mKey];

      if (!existingMarker) {
        const el = document.createElement('div');
        el.className = 'cursor-pointer transition-transform hover:scale-110';

        if (markerData.type === 'user') {
          // Dynamic GPS Vehicle / User Icon with heading orientation
          el.innerHTML = `
            <div class="relative flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2">
              ${showHeatmapLayer ? '<span class="animate-radar-glow absolute inline-flex h-16 w-16 rounded-full bg-emerald-400 opacity-60"></span><span class="animate-ping absolute inline-flex h-10 w-10 rounded-full bg-emerald-500 opacity-75"></span>' : ''}
              <div class="relative z-10 w-7 h-7 rounded-full bg-emerald-600 border-2 border-white shadow-xl flex items-center justify-center text-white ring-2 ring-emerald-300">
                <svg data-arrow class="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
                </svg>
              </div>
            </div>
          `;
        } else if (markerData.type === 'destination') {
          el.innerHTML = `
            <div class="flex flex-col items-center transform -translate-x-1/2 -translate-y-full">
              <div class="bg-rose-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-lg border border-white flex items-center gap-1 whitespace-nowrap">
                <span>📍 ${escapeHtml(isRtl && markerData.titleUrdu ? markerData.titleUrdu : (markerData.title || 'Destination'))}</span>
              </div>
              <div class="w-1.5 h-2.5 bg-rose-600 -mt-0.5"></div>
            </div>
          `;
        } else if (markerData.type === 'incident') {
          let badgeColor = 'bg-rose-500';
          let iconSvg = '⚠️';
          if (markerData.category === 'flooding' || markerData.category === 'flood') {
            badgeColor = 'bg-cyan-600';
            iconSvg = '🌊';
          } else if (markerData.category === 'roadblock') {
            badgeColor = 'bg-amber-600';
            iconSvg = '⛔';
          } else if (markerData.category === 'construction') {
            badgeColor = 'bg-orange-500';
            iconSvg = '🚧';
          }

          el.innerHTML = `
            <div class="w-7 h-7 rounded-full ${badgeColor} text-white border-2 border-white shadow-lg flex items-center justify-center text-xs animate-bounce" title="${escapeHtml(markerData.title || 'Traffic Incident')}">
              <span>${iconSvg}</span>
            </div>
          `;
        } else {
          el.innerHTML = `
            <div class="w-4 h-4 rounded-full bg-indigo-600 border-2 border-white shadow"></div>
          `;
        }

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (onMarkerClick) {
            onMarkerClick(markerData);
          }
        });

        const popupHtml = `
          <div style="padding: 6px; font-family: sans-serif; min-width: 170px;">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #059669; margin-bottom: 2px;">
              ${escapeHtml(markerData.type.replace('_', ' ').toUpperCase())}
            </div>
            <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 4px;">
              ${escapeHtml(isRtl && markerData.titleUrdu ? markerData.titleUrdu : (markerData.title || 'Location'))}
            </div>
            ${markerData.incidentData ? `
              <div style="font-size: 11px; color: #475569; margin-bottom: 3px;">
                <strong>Credibility:</strong> ${escapeHtml(markerData.incidentData.credibilityScore)}% (${escapeHtml(markerData.incidentData.upvotes)} upvotes)
              </div>
              <div style="font-size: 11px; color: #64748b; font-style: italic;">
                "${escapeHtml(isRtl ? markerData.incidentData.descriptionUrdu : markerData.incidentData.description)}"
              </div>
            ` : ''}
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 22, closeButton: true }).setHTML(popupHtml);

        const newMarker = new maplibregl.Marker({ element: el })
          .setLngLat([markerData.lng, markerData.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current[mKey] = newMarker;
      } else {
        existingMarker.setLngLat([markerData.lng, markerData.lat]);
      }
      if (markerData.type === 'user') {
        // While navigating the map itself turns to the heading, so the arrow points up; otherwise (north-up) it shows the heading.
        const arrow = markersRef.current[mKey]?.getElement().querySelector<SVGElement>('[data-arrow]');
        if (arrow) arrow.style.transform = `rotate(${isNavigatingLive ? 0 : (markerData.heading ?? 0)}deg)`;
      }
    });
  }, [filteredMarkers, isRtl, onMarkerClick, showHeatmapLayer, isNavigatingLive]);

  // Past-flooding layer: the data is a separate chunk, fetched only the first time the layer is switched on
  useEffect(() => {
    if (!showFloodLayer || floodEvents) return;
    let cancelled = false;
    import('../data/flood/lahore.json')
      .then((m) => { if (!cancelled) setFloodEvents((m.default as unknown as { events: FloodEvent[] }).events); })
      .catch((err) => console.warn('Flood layer data failed to load:', err));
    return () => { cancelled = true; };
  }, [showFloodLayer, floodEvents]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const ids = (floodEvents ?? []).map((_, i) => `rasta-flood-${i}`);
    const clear = () => {
      for (const id of ids) {
        if (map.getLayer(`${id}-line`)) map.removeLayer(`${id}-line`);
        if (map.getLayer(`${id}-fill`)) map.removeLayer(`${id}-fill`);
        if (map.getSource(id)) map.removeSource(id);
      }
    };
    clear();
    if (!showFloodLayer || !floodEvents) return;
    floodEvents.forEach((ev, i) => {
      const id = ids[i];
      const colour = FLOOD_COLOURS[i % FLOOD_COLOURS.length];
      map.addSource(id, {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: ev.polygons } }
      });
      map.addLayer({ id: `${id}-fill`, type: 'fill', source: id, paint: { 'fill-color': colour, 'fill-opacity': 0.4 } });
      map.addLayer({ id: `${id}-line`, type: 'line', source: id, paint: { 'line-color': colour, 'line-width': 1 } });
    });
    return clear;
  }, [showFloodLayer, floodEvents, mapLoaded, styleVersion]);

  // Update Route Polyline Layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const sourceId = 'rasta-route-source';
    const casingLayerId = 'rasta-route-casing';
    const lineLayerId = 'rasta-route-line';

    if (route && route.coordinates && route.coordinates.length > 1 && showRouteLayer) {
      const geojson = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: route.coordinates.map((c) => [c.lng, c.lat])
        }
      };

      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojson);
      } else {
        map.addSource(sourceId, {
          type: 'geojson',
          data: geojson
        });

        // Background dark casing
        map.addLayer({
          id: casingLayerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#064e3b',
            'line-width': (route.weight || 6) + 3,
            'line-opacity': 0.85
          }
        });

        // Foreground vibrant route line
        map.addLayer({
          id: lineLayerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': route.color || '#10b981',
            'line-width': route.weight || 6,
            'line-opacity': 1.0
          }
        });
      }

      // Auto-fit only once per distinct route (never on every re-render / GPS tick)
      if (!isNavigatingLive && fittedRouteRef.current !== route.id) {
        fittedRouteRef.current = route.id;
        const bounds = new maplibregl.LngLatBounds();
        route.coordinates.forEach((c) => bounds.extend([c.lng, c.lat]));
        map.fitBounds(bounds, {
          padding: { top: 80, bottom: 90, left: 60, right: 60 },
          maxZoom: 16,
          duration: 700
        });
      }
    } else {
      if (!route) fittedRouteRef.current = null;
      if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
      if (map.getLayer(casingLayerId)) map.removeLayer(casingLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  }, [route, mapLoaded, isNavigatingLive, showRouteLayer, styleVersion]);

  // Style switcher
  const toggleStyle = () => {
    const map = mapRef.current;
    if (!map) return;
    const nextMode = STYLE_MODES[(STYLE_MODES.indexOf(styleMode) + 1) % STYLE_MODES.length];
    setStyleMode(nextMode);
    try {
      map.setStyle(getStyleSpec(nextMode));
    } catch (err) {
      console.warn('Failed to switch MapLibre style:', err);
    }
  };

  // If WebGL is not supported, seamlessly render the pure HTML OsmMapView
  if (!webGlSupported) {
    const userMarker = markers.find((m) => m.type === 'user');
    const destMarker = markers.find((m) => m.type === 'destination');
    const incidentItems = markers.filter((m) => m.incidentData).map((m) => m.incidentData!);

    return (
      <OsmMapView
        center={center}
        zoom={zoom}
        userLocation={userMarker ? { lat: userMarker.lat, lng: userMarker.lng } : null}
        origin={null}
        destination={
          destMarker
            ? {
                id: destMarker.id,
                name: destMarker.title || 'Destination',
                nameUrdu: destMarker.titleUrdu || 'منزل',
                lat: destMarker.lat,
                lng: destMarker.lng
              }
            : null
        }
        travelMode={travelMode}
        incidents={incidentItems}
        isNavigatingLive={isNavigatingLive}
        heading={heading}
        onMapClick={(lat, lng) => onMapClick && onMapClick({ lat, lng })}
        onIncidentSelect={(inc) => {
          const m = markers.find((item) => item.id === inc.id);
          if (m && onMarkerClick) onMarkerClick(m);
        }}
      />
    );
  }

  return (
    <div className={`relative w-full h-full min-h-[300px] overflow-hidden select-none bg-slate-100 dark:bg-slate-900 ${className}`}>
      {/* MapLibre Canvas Container */}
      <div ref={containerRef} className="w-full h-full min-h-[300px]" />

      {mapSlow && !mapLoaded && (
        <div role="status" className="absolute inset-x-4 top-24 z-20 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold p-3 text-center">
          {isRtl ? 'نقشہ لوڈ نہیں ہو سکا۔ اپنا انٹرنیٹ چیک کریں۔' : "The map couldn't load. Check your connection; routes and search may still work."}
        </div>
      )}

      {showFloodLayer && floodLabels && (
        <div className={`absolute bottom-2 ${isRtl ? 'right-2' : 'left-2'} z-10 rounded bg-white/90 dark:bg-slate-900/90 px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-300`}>
          {floodLabels.credit}
        </div>
      )}

      {isNavigatingLive && freeLook && (
        <button
          type="button"
          onClick={() => { if (freeLookTimer.current) clearTimeout(freeLookTimer.current); setFreeLook(false); }}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-xl cursor-pointer"
        >
          ➤ {recenterLabel}
        </button>
      )}

      {/* Floating Map Controls */}
      <div
        style={{ top: controlsTopPx }}
        className={`absolute ${
          isRtl ? 'right-4' : 'left-4'
        } z-10 flex flex-col gap-2 items-center`}
      >
        {/* Layer Control Menu */}
        <div className={`relative ${isNavigatingLive ? 'hidden' : ''}`}>
          <button
            onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
            className="bg-white/95 dark:bg-slate-900/95 backdrop-blur text-slate-800 dark:text-slate-100 p-2.5 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Toggle Map Data Layers"
          >
            <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Layers</span>
          </button>

          {isLayerMenuOpen && (
            <div className={`absolute ${isRtl ? 'right-full mr-2' : 'left-full ml-2'} top-0 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3 z-50 space-y-2.5`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Map Data Layers</span>
                <button onClick={() => setIsLayerMenuOpen(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
              </div>

              <label className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 rounded-lg">
                <span className="flex items-center gap-2">⚠️ Incident Pins</span>
                <input
                  type="checkbox"
                  checked={showIncidentsLayer}
                  onChange={(e) => setShowIncidentsLayer(e.target.checked)}
                  className="rounded accent-emerald-600 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 rounded-lg">
                <span className="flex items-center gap-2">📍 Route Polyline</span>
                <input
                  type="checkbox"
                  checked={showRouteLayer}
                  onChange={(e) => setShowRouteLayer(e.target.checked)}
                  className="rounded accent-emerald-600 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 rounded-lg">
                <span className="flex items-center gap-2">📡 Location Pulse</span>
                <input
                  type="checkbox"
                  checked={showHeatmapLayer}
                  onChange={(e) => setShowHeatmapLayer(e.target.checked)}
                  className="rounded accent-emerald-600 w-4 h-4"
                />
              </label>
              {floodLabels && (
                <div className="p-1.5 space-y-1.5">
                  <label className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <span className="flex items-center gap-2">🌊 {floodLabels.layer}</span>
                    <input
                      type="checkbox"
                      checked={showFloodLayer}
                      onChange={(e) => setShowFloodLayer(e.target.checked)}
                      className="rounded accent-emerald-600 w-4 h-4"
                    />
                  </label>
                  {showFloodLayer && (
                    <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                      {(floodEvents ?? []).map((ev, i) => (
                        <div key={ev.id} className="flex items-center gap-1.5">
                          <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: FLOOD_COLOURS[i % FLOOD_COLOURS.length], opacity: 0.6 }} />
                          <span>{i === 0 ? floodLabels.event1 : i === 1 ? floodLabels.event2 : ev.title}</span>
                        </div>
                      ))}
                      <p className="leading-snug">{floodLabels.note}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Style Switcher */}
        <button
          onClick={toggleStyle}
          hidden={isNavigatingLive}
          className="bg-white/95 dark:bg-slate-900/95 backdrop-blur text-slate-800 dark:text-slate-100 p-2.5 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          title="Cycle map styles (Liberty / Bright / Light)"
        >
          <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden sm:inline">
            {styleMode === 'liberty' ? 'Liberty' : styleMode === 'bright' ? 'Bright' : 'Light'}
          </span>
        </button>

        {/* Zoom Controls */}
        <div className={`bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden ${isNavigatingLive ? 'hidden' : ''}`}>
          <button
            onClick={() => mapRef.current?.zoomIn()}
            className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 transition-colors"
            title="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapRef.current?.zoomOut()}
            className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
            title="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        {/* Reset Bearing (North) */}
        <button
          onClick={() => mapRef.current?.resetNorthPitch()}
          className="bg-white/95 dark:bg-slate-900/95 backdrop-blur p-2.5 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Reset Bearing (North)"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};

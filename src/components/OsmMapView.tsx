/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { LocationPoint, CommunityIncident, TravelMode } from '../types';
import { Navigation, AlertTriangle, Plus, Minus, Compass, Car, Bike, Footprints, Layers } from 'lucide-react';

interface OsmMapViewProps {
  center: { lat: number; lng: number };
  zoom: number;
  userLocation: { lat: number; lng: number } | null;
  origin: LocationPoint | null;
  destination: LocationPoint | null;
  travelMode: TravelMode;
  incidents: CommunityIncident[];
  onMapClick?: (lat: number, lng: number) => void;
  onIncidentSelect?: (incident: CommunityIncident) => void;
  routeCoordinates?: { lat: number; lng: number }[];
  isNavigatingLive?: boolean;
  heading?: number;
}

export const OsmMapView: React.FC<OsmMapViewProps> = ({
  center,
  zoom: initialZoom,
  userLocation,
  origin,
  destination,
  travelMode,
  incidents,
  onMapClick,
  onIncidentSelect,
  routeCoordinates,
  isNavigatingLive = false,
  heading = 0
}) => {
  const [zoom, setZoom] = useState(initialZoom || 13);
  const [currentCenter, setCurrentCenter] = useState(center);
  const [tileSource, setTileSource] = useState<'arcgis' | 'cyclosm' | 'satellite'>('arcgis');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Guarantee non-zero dimensions on mount and responsive resizing
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.5) : 450
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth || window.innerWidth;
        const h = containerRef.current.clientHeight || 450;
        setContainerSize({ width: w, height: h });
      }
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(containerRef.current);
    window.addEventListener('resize', updateSize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Update center smoothly when props change
  useEffect(() => {
    setCurrentCenter(center);
  }, [center.lat, center.lng]);

  // Sync zoom when navigation triggers zoom adjustments
  useEffect(() => {
    if (initialZoom) {
      setZoom(initialZoom);
    }
  }, [initialZoom]);

  // Convert lat/lng to tile numbers
  const lat2tile = (lat: number, z: number) =>
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
    Math.pow(2, z);

  const lng2tile = (lon: number, z: number) =>
    ((lon + 180) / 360) * Math.pow(2, z);

  // Convert lat/lng to screen pixel coordinates relative to center
  const projectToScreen = (lat: number, lng: number) => {
    const width = containerSize.width || 800;
    const height = containerSize.height || 450;

    const centerTileX = lng2tile(currentCenter.lng, zoom);
    const centerTileY = lat2tile(currentCenter.lat, zoom);

    const targetTileX = lng2tile(lng, zoom);
    const targetTileY = lat2tile(lat, zoom);

    const x = width / 2 + (targetTileX - centerTileX) * 256;
    const y = height / 2 + (targetTileY - centerTileY) * 256;

    return { x, y };
  };

  // Convert screen pixel coordinates back to geographical coordinates
  const screenToLatLon = (screenX: number, screenY: number) => {
    const width = containerSize.width || 800;
    const height = containerSize.height || 450;

    const centerTileX = lng2tile(currentCenter.lng, zoom);
    const centerTileY = lat2tile(currentCenter.lat, zoom);

    const targetTileX = centerTileX + (screenX - width / 2) / 256;
    const targetTileY = centerTileY + (screenY - height / 2) / 256;

    const lng = (targetTileX / Math.pow(2, zoom)) * 360 - 180;
    const n = Math.PI - (2 * Math.PI * targetTileY) / Math.pow(2, zoom);
    const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

    return { lat, lng };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setHasMoved(false);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      setHasMoved(true);
    }

    const tileDx = dx / 256;
    const tileDy = dy / 256;

    const scale = Math.pow(2, zoom);
    const dLng = -(tileDx * 360) / scale;
    const dLat = (tileDy * 170) / scale;

    setCurrentCenter((prev) => ({
      lat: prev.lat + dLat,
      lng: prev.lng + dLng
    }));

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!hasMoved && onMapClick && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const geo = screenToLatLon(clickX, clickY);
      onMapClick(geo.lat, geo.lng);
    }
    setIsDragging(false);
    setDragStart(null);
  };

  // Touch support for mobile devices
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setHasMoved(false);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !dragStart || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStart.x;
    const dy = e.touches[0].clientY - dragStart.y;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      setHasMoved(true);
    }

    const tileDx = dx / 256;
    const tileDy = dy / 256;

    const scale = Math.pow(2, zoom);
    const dLng = -(tileDx * 360) / scale;
    const dLat = (tileDy * 170) / scale;

    setCurrentCenter((prev) => ({
      lat: prev.lat + dLat,
      lng: prev.lng + dLng
    }));

    setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  // Generate slippy map tiles using reliable CartoDB Voyager tiles (OpenStreetMap data)
  const renderTiles = () => {
    const width = containerSize.width || 800;
    const height = containerSize.height || 450;

    const centerTileX = lng2tile(currentCenter.lng, zoom);
    const centerTileY = lat2tile(currentCenter.lat, zoom);

    const tileStartX = Math.floor(centerTileX - width / 512) - 1;
    const tileEndX = Math.floor(centerTileX + width / 512) + 1;
    const tileStartY = Math.floor(centerTileY - height / 512) - 1;
    const tileEndY = Math.floor(centerTileY + height / 512) + 1;

    const tiles = [];
    const maxTile = Math.pow(2, zoom);

    for (let tx = tileStartX; tx <= tileEndX; tx++) {
      for (let ty = tileStartY; ty <= tileEndY; ty++) {
        const wrappedX = ((tx % maxTile) + maxTile) % maxTile;
        if (ty < 0 || ty >= maxTile) continue;

        const posX = width / 2 + (tx - centerTileX) * 256;
        const posY = height / 2 + (ty - centerTileY) * 256;

        let tileUrl = '';
        if (tileSource === 'satellite') {
          tileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${wrappedX}`;
        } else if (tileSource === 'cyclosm') {
          const sub = ['a', 'b', 'c'][Math.abs(wrappedX + ty) % 3];
          tileUrl = `https://${sub}.tile-cyclosm.openstreetmap.fr/cyclosm/${zoom}/${wrappedX}/${ty}.png`;
        } else {
          // Default: 100% Free ArcGIS World Street Map (high definition street network, labeled chowks, 0 keys, 0 watermark)
          tileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${ty}/${wrappedX}`;
        }

        tiles.push(
          <img
            key={`${zoom}-${tx}-${ty}-${tileSource}`}
            src={tileUrl}
            alt=""
            loading="lazy"
            onError={(e) => {
              // Fallback to ArcGIS World Street Map if secondary provider has transient error
              const target = e.currentTarget;
              if (!target.dataset.fallbackApplied) {
                target.dataset.fallbackApplied = 'true';
                target.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${ty}/${wrappedX}`;
              }
            }}
            className="absolute select-none pointer-events-none transition-opacity duration-200"
            style={{
              width: 256,
              height: 256,
              left: `${posX}px`,
              top: `${posY}px`
            }}
          />
        );
      }
    }
    return tiles;
  };

  const originScreen = origin ? projectToScreen(origin.lat, origin.lng) : null;
  const destScreen = destination ? projectToScreen(destination.lat, destination.lng) : null;
  const userScreen = userLocation ? projectToScreen(userLocation.lat, userLocation.lng) : null;

  // Compute polyline points for active route
  const polylinePoints = routeCoordinates && routeCoordinates.length > 1
    ? routeCoordinates
        .map((coord) => {
          const pt = projectToScreen(coord.lat, coord.lng);
          return `${pt.x},${pt.y}`;
        })
        .join(' ')
    : originScreen && destScreen
    ? `${originScreen.x},${originScreen.y} ${destScreen.x},${destScreen.y}`
    : '';

  // Mode stroke styling
  let routeColor = '#10b981'; // Green for car/driving
  let routeDash = '';
  if (travelMode === 'TWO_WHEELER') {
    routeColor = '#3b82f6'; // Blue for motorcycle
  } else if (travelMode === 'WALKING') {
    routeColor = '#f59e0b'; // Amber for walking
    routeDash = '6 6';
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => setIsDragging(false)}
      className="relative w-full h-full min-h-[300px] overflow-hidden bg-slate-100 dark:bg-slate-900 cursor-grab active:cursor-grabbing select-none"
    >
      {/* Reliable CartoDB Voyager Slippy Tiles */}
      <div className="absolute inset-0 overflow-hidden">{renderTiles()}</div>

      {/* Route SVG Polyline along route coordinates */}
      {polylinePoints && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {/* Dark Outer Casing */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="#064e3b"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.8"
          />
          {/* Main Route Line */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke={routeColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={routeDash}
            className={travelMode === 'WALKING' ? 'animate-pulse' : ''}
          />
        </svg>
      )}

      {/* User / Vehicle GPS Location with Real Navigation Puck */}
      {userScreen && (
        <div
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-300"
          style={{ left: `${userScreen.x}px`, top: `${userScreen.y}px` }}
        >
          <div className="relative flex items-center justify-center">
            {/* Directional Forward Beam when navigating */}
            {isNavigatingLive && (
              <div
                className="absolute w-16 h-16 pointer-events-none transition-transform duration-300"
                style={{ transform: `rotate(${heading}deg)` }}
              >
                <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[28px] border-b-emerald-400/40 mx-auto -mt-3 filter blur-[1px]"></div>
              </div>
            )}
            <span className="absolute inline-flex h-12 w-12 rounded-full bg-emerald-500 opacity-75 animate-radar-glow"></span>
            <div
              className="relative z-10 w-8 h-8 rounded-full bg-emerald-600 border-2 border-white shadow-2xl flex items-center justify-center text-white ring-4 ring-emerald-400/40 transition-transform duration-300"
              style={{
                transform: heading ? `rotate(${heading}deg)` : undefined
              }}
            >
              {travelMode === 'TWO_WHEELER' ? (
                <Bike className="w-4 h-4 fill-current" />
              ) : travelMode === 'WALKING' ? (
                <Footprints className="w-4 h-4" />
              ) : (
                <Navigation className="w-4 h-4 fill-current transform rotate-45" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Destination Pin */}
      {destScreen && (
        <div
          className="absolute z-20 -translate-x-1/2 -translate-y-full pointer-events-auto cursor-pointer"
          style={{ left: `${destScreen.x}px`, top: `${destScreen.y}px` }}
        >
          <div className="bg-rose-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xl border border-white flex items-center gap-1 whitespace-nowrap">
            <span>📍 {destination?.name || 'Destination'}</span>
          </div>
          <div className="w-1.5 h-3 bg-rose-600 mx-auto -mt-0.5"></div>
        </div>
      )}

      {/* Community Incidents Pins */}
      {incidents.map((inc) => {
        const pt = projectToScreen(inc.lat, inc.lng);
        const refLat = userLocation?.lat || center.lat;
        const refLng = userLocation?.lng || center.lng;
        const distanceKm = Math.sqrt(Math.pow(inc.lat - refLat, 2) + Math.pow(inc.lng - refLng, 2)) * 111;
        const isNearby = distanceKm <= 5.0;

        let badgeColor = 'bg-rose-600';
        if (inc.category === 'flooding') badgeColor = 'bg-cyan-600';
        if (inc.category === 'roadblock') badgeColor = 'bg-amber-600';
        if (inc.category === 'construction') badgeColor = 'bg-orange-500';
        if (inc.category === 'police_naka') badgeColor = 'bg-indigo-600';

        return (
          <div
            key={inc.id}
            onClick={(e) => {
              e.stopPropagation();
              onIncidentSelect && onIncidentSelect(inc);
            }}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:scale-125 transition-transform"
            style={{ left: `${pt.x}px`, top: `${pt.y}px` }}
            title={`${inc.title} (${distanceKm < 1 ? Math.round(distanceKm * 1000) + 'm' : distanceKm.toFixed(1) + 'km'} away)`}
          >
            <div className="relative flex items-center justify-center">
              {isNearby && (
                <span className="absolute inline-flex h-12 w-12 rounded-full bg-amber-500 opacity-75 animate-radar-glow pointer-events-none"></span>
              )}
              <div className={`relative z-10 w-7 h-7 rounded-full ${badgeColor} text-white border-2 border-white shadow-xl flex items-center justify-center animate-bounce`}>
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        );
      })}

      {/* Attribution & Layer Selector */}
      <div className="absolute bottom-1 right-2 z-30 flex items-center gap-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-2 py-0.5 rounded text-[10px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
        <span>© OpenStreetMap • Esri ArcGIS</span>
      </div>

      {/* Floating Map Controls & Layer Selector */}
      <div className="absolute top-20 right-3 z-30 flex flex-col gap-1.5 shadow-md items-end">
        {/* Layer Mode Switcher */}
        <div className="flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-xl border border-slate-200 dark:border-slate-800 p-1 shadow-md gap-1">
          <button
            type="button"
            onClick={() => setTileSource('arcgis')}
            className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
              tileSource === 'arcgis'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="ArcGIS World Street Map (Free, 0 Keys)"
          >
            Streets
          </button>
          <button
            type="button"
            onClick={() => setTileSource('cyclosm')}
            className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
              tileSource === 'cyclosm'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="OpenStreetMap CyclOSM (Free, 0 Keys)"
          >
            OSM
          </button>
          <button
            type="button"
            onClick={() => setTileSource('satellite')}
            className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
              tileSource === 'satellite'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Satellite Imagery (Free, 0 Keys)"
          >
            Satellite
          </button>
        </div>

        {/* Floating Zoom Controls */}
        <div className="flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-xl shadow-md border border-slate-200 dark:border-slate-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(19, z + 1))}
            className="w-8 h-8 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 flex items-center justify-center font-bold cursor-pointer"
            title="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(6, z - 1))}
            className="w-8 h-8 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center font-bold cursor-pointer"
            title="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

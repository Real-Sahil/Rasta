/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { CommunityIncident, LocationPoint, TravelMode } from '../types';
import { OsmMapView } from './OsmMapView';

interface GoogleMapViewProps {
  apiKey: string;
  center: { lat: number; lng: number };
  zoom?: number;
  userLocation?: { lat: number; lng: number } | null;
  destination?: LocationPoint | null;
  travelMode?: TravelMode;
  incidents?: CommunityIncident[];
  isRtl?: boolean;
  showTraffic?: boolean;
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  onIncidentClick?: (incident: CommunityIncident) => void;
  routeCoordinates?: { lat: number; lng: number }[];
  onSwitchToOsm?: () => void;
}

// Inner map child component to manage layers, polylines, and bounds
const MapContent: React.FC<{
  center: { lat: number; lng: number };
  zoom: number;
  userLocation?: { lat: number; lng: number } | null;
  destination?: LocationPoint | null;
  incidents?: CommunityIncident[];
  isRtl?: boolean;
  showTraffic?: boolean;
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  onIncidentClick?: (incident: CommunityIncident) => void;
  routeCoordinates?: { lat: number; lng: number }[];
}> = ({
  center,
  zoom,
  userLocation,
  destination,
  incidents = [],
  isRtl = false,
  showTraffic = true,
  onMapClick,
  onIncidentClick,
  routeCoordinates
}) => {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const coreLib = useMapsLibrary('core');
  const routesLib = useMapsLibrary('routes');
  const trafficLayerRef = useRef<any>(null);
  const polylinesRef = useRef<any[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<CommunityIncident | null>(null);

  // Traffic Layer setup
  useEffect(() => {
    if (!map) return;

    if (showTraffic) {
      const TrafficLayerClass = mapsLib?.TrafficLayer || (window as any).google?.maps?.TrafficLayer;
      if (TrafficLayerClass && !trafficLayerRef.current) {
        trafficLayerRef.current = new TrafficLayerClass();
      }
      if (trafficLayerRef.current) {
        trafficLayerRef.current.setMap(map);
      }
    } else if (trafficLayerRef.current) {
      trafficLayerRef.current.setMap(null);
    }

    return () => {
      if (trafficLayerRef.current) {
        trafficLayerRef.current.setMap(null);
      }
    };
  }, [map, mapsLib, showTraffic]);

  // Center change
  useEffect(() => {
    if (map && center) {
      map.panTo(center);
    }
  }, [map, center.lat, center.lng]);

  // Route drawing
  useEffect(() => {
    if (!map) return;

    // Clear old polylines
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const PolylineClass = mapsLib?.Polyline || (window as any).google?.maps?.Polyline;
    const LatLngBoundsClass = coreLib?.LatLngBounds || (window as any).google?.maps?.LatLngBounds;

    if (PolylineClass && routeCoordinates && routeCoordinates.length > 1) {
      const path = routeCoordinates.map((c) => ({ lat: c.lat, lng: c.lng }));

      // Outer outline
      const casing = new PolylineClass({
        path,
        strokeColor: '#064e3b',
        strokeWeight: 8,
        strokeOpacity: 0.9,
        map
      });

      // Main line
      const polyline = new PolylineClass({
        path,
        strokeColor: '#10b981',
        strokeWeight: 5,
        strokeOpacity: 1.0,
        map
      });

      polylinesRef.current = [casing, polyline];

      // Fit bounds safely with core LatLngBounds
      if (LatLngBoundsClass) {
        const bounds = new LatLngBoundsClass();
        routeCoordinates.forEach((c) => bounds.extend(c));
        map.fitBounds(bounds, { top: 70, right: 70, bottom: 120, left: 70 });
      }
    }

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, mapsLib, coreLib, routeCoordinates]);

  return (
    <>
      {/* Current User GPS Marker */}
      {userLocation && (
        <AdvancedMarker position={userLocation} title="Your Location">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-8 h-8 bg-emerald-500/30 rounded-full animate-ping" />
            <div className="w-4 h-4 bg-emerald-600 border-2 border-white rounded-full shadow-lg" />
          </div>
        </AdvancedMarker>
      )}

      {/* Destination Marker */}
      {destination && (
        <AdvancedMarker
          position={{ lat: destination.lat, lng: destination.lng }}
          title={isRtl ? destination.nameUrdu : destination.name}
        >
          <div className="flex items-center justify-center w-8 h-8 bg-rose-600 text-white rounded-full shadow-xl border-2 border-white ring-2 ring-rose-300">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
          </div>
        </AdvancedMarker>
      )}

      {/* Community Incident Markers */}
      {incidents.map((incident) => (
        <AdvancedMarker
          key={incident.id}
          position={{ lat: incident.lat, lng: incident.lng }}
          onClick={() => {
            setSelectedIncident(incident);
            if (onIncidentClick) onIncidentClick(incident);
          }}
        >
          <div className="flex items-center justify-center w-7 h-7 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-lg border-2 border-white cursor-pointer transform hover:scale-110 transition-transform">
            <span className="text-xs font-bold">!</span>
          </div>
        </AdvancedMarker>
      ))}

      {/* Incident InfoWindow */}
      {selectedIncident && (
        <InfoWindow
          position={{ lat: selectedIncident.lat, lng: selectedIncident.lng }}
          onCloseClick={() => setSelectedIncident(null)}
        >
          <div className={`p-2 max-w-xs ${isRtl ? 'font-urdu text-right' : ''}`}>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase">
              {selectedIncident.isOfficialVerified ? 'PSCA Verified' : 'Community Alert'}
            </span>
            <h4 className="font-bold text-sm text-slate-900 mt-1">
              {isRtl ? selectedIncident.titleUrdu : selectedIncident.title}
            </h4>
            <p className="text-xs text-slate-600 mt-1">
              {isRtl ? selectedIncident.descriptionUrdu : selectedIncident.description}
            </p>
            {selectedIncident.alternativeRouteAdvice && (
              <div className="mt-2 p-1.5 bg-emerald-50 rounded text-xs text-emerald-800">
                <strong>{isRtl ? 'تجویز:' : 'Advisory:'}</strong>{' '}
                {isRtl ? selectedIncident.alternativeRouteAdviceUrdu : selectedIncident.alternativeRouteAdvice}
              </div>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
};

export const GoogleMapView: React.FC<GoogleMapViewProps> = (props) => {
  const [apiError, setApiError] = useState(false);
  const hasKey = Boolean(props.apiKey && props.apiKey.trim() !== '' && !props.apiKey.includes('MY_'));

  if (!hasKey || apiError) {
    return (
      <div className="relative w-full h-full min-h-[300px]">
        <OsmMapView
          center={props.center}
          zoom={props.zoom || 13}
          userLocation={props.userLocation || null}
          origin={null}
          destination={props.destination || null}
          travelMode={props.travelMode || 'DRIVING'}
          incidents={props.incidents || []}
          onMapClick={(lat, lng) => props.onMapClick && props.onMapClick({ lat, lng })}
          onIncidentSelect={props.onIncidentClick}
          routeCoordinates={props.routeCoordinates}
        />
        <div className="absolute top-20 left-3 right-3 sm:left-auto sm:right-3 sm:max-w-sm z-30 bg-slate-900/95 backdrop-blur text-white p-3 rounded-xl border border-slate-700 shadow-xl text-xs space-y-1.5 pointer-events-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="font-bold text-[11px] truncate">
                {props.isRtl ? '100% مفت اوپن میپ فعال ہے' : '100% Free Open Maps Active'}
              </span>
            </div>
            {props.onSwitchToOsm && (
              <button
                type="button"
                onClick={props.onSwitchToOsm}
                className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 cursor-pointer"
              >
                {props.isRtl ? 'سوئچ کریں' : 'Keep Free Engine'}
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-300 leading-relaxed">
            {apiError
              ? (props.isRtl
                  ? 'گوگل میپس کی تصدیق ناکام ہو گئی۔ مفت اوپن میپ بلا معاوضہ فعال ہے۔'
                  : 'Google Maps key error. Switched automatically to free open-source map (no key needed).')
              : (props.isRtl
                  ? 'گوگل میپس کے لیے API کی درکار ہے۔ مفت نقشہ پہلے سے فعال ہے۔'
                  : 'Google Maps requires a paid Google Cloud key. Enjoy 100% free open street map below with zero setup.')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[300px]">
      <APIProvider
        apiKey={props.apiKey}
        language={props.isRtl ? 'ur' : 'en'}
        region="PK"
        onError={(err) => {
          console.warn('Google Maps API load failed, switching to free Open Maps:', err);
          setApiError(true);
        }}
      >
        <Map
          mapId="DEMO_MAP_ID"
          defaultCenter={props.center}
          defaultZoom={props.zoom || 13}
          gestureHandling="greedy"
          disableDefaultUI={false}
          className="w-full h-full"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          onClick={(e) => {
            if (e.detail.latLng && props.onMapClick) {
              props.onMapClick({
                lat: e.detail.latLng.lat,
                lng: e.detail.latLng.lng
              });
            }
          }}
        >
          <MapContent {...props} zoom={props.zoom || 13} />
        </Map>
      </APIProvider>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { RouteOption, TravelMode, LocationPoint } from '../types';
import { useMobilityTheme } from './ThemeLayoutWrapper';
import { speechNavigator } from '../services/speechNavigation';
import {
  Navigation,
  Car,
  Bike,
  Train,
  Footprints,
  Volume2,
  VolumeX,
  Gauge,
  CornerUpRight,
  ArrowRight,
  X,
  CheckCircle,
  Clock,
  Sparkles,
  Mountain,
  CloudRain,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  Compass
} from 'lucide-react';
import { RouteElevationVisualizer } from './RouteElevationVisualizer';
import { RouteTimeCostChart } from './RouteTimeCostChart';
import { TrafficCongestionChart } from './TrafficCongestionChart';
import { fetchCityWeather, WeatherData } from '../services/weatherService';

interface NavigationPanelProps {
  origin: LocationPoint | null;
  destination: LocationPoint | null;
  activeRoute: RouteOption | null;
  routes: RouteOption[];
  onSelectRoute: (route: RouteOption) => void;
  travelMode: TravelMode;
  onTravelModeChange: (mode: TravelMode) => void;
  onClearNavigation: () => void;
  isNavigatingLive?: boolean;
  onStartNavigation?: () => void;
  onStopNavigation?: () => void;
  currentStepIndex?: number;
  onStepChange?: (index: number) => void;
  simulatedSpeed?: number;
  onReportIncident?: () => void;
  originMode?: 'current' | 'manual' | 'map';
  onOriginModeChange?: (mode: 'current' | 'manual' | 'map') => void;
  userLocation?: { lat: number; lng: number } | null;
  onRecenter?: () => void;
}

export const NavigationPanel: React.FC<NavigationPanelProps> = ({
  origin,
  destination,
  activeRoute,
  routes,
  onSelectRoute,
  travelMode,
  onTravelModeChange,
  onClearNavigation,
  isNavigatingLive: controlledNavigating,
  onStartNavigation,
  onStopNavigation,
  currentStepIndex: controlledStepIndex,
  onStepChange,
  simulatedSpeed: controlledSpeed,
  onReportIncident,
  originMode = 'current',
  onOriginModeChange,
  userLocation,
  onRecenter
}) => {
  const { language, isRtl, t } = useMobilityTheme();
  const [internalNavigating, setInternalNavigating] = useState(false);
  const [internalStepIndex, setInternalStepIndex] = useState(0);
  const [internalSpeed, setInternalSpeed] = useState(42);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [gpsValidationError, setGpsValidationError] = useState<string | null>(null);

  const isNavigatingLive = controlledNavigating !== undefined ? controlledNavigating : internalNavigating;
  const currentStepIndex = controlledStepIndex !== undefined ? controlledStepIndex : internalStepIndex;
  const simulatedSpeed = controlledSpeed !== undefined ? controlledSpeed : internalSpeed;

  const [isAdaptiveRoutingActive, setIsAdaptiveRoutingActive] = useState(true);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetchCityWeather('lahore').then(res => {
      setWeatherData(res);
      if (isAdaptiveRoutingActive && res.isHeavyRain && routes.length > 0) {
        const saferRoute = routes.find(r => r.via.toLowerCase().includes('canal') || r.via.toLowerCase().includes('surface') || r.isRecommended) || routes[0];
        onSelectRoute(saferRoute);
      }
    });
  }, [isAdaptiveRoutingActive, routes]);

  const handleStart = () => {
    // Check if starting from current location but GPS position is unavailable
    if (originMode === 'current' && !userLocation) {
      setGpsValidationError(
        isRtl
          ? 'GPS لوکیشن دستیاب نہیں یا اجازت درکار ہے۔ براہ کرم مقام کی اجازت دیں یا دستی طور پر منتخب کریں۔'
          : 'GPS location unavailable or permission denied. Please enable location or choose a manual starting point.'
      );
      return;
    }
    setGpsValidationError(null);
    if (onStartNavigation) onStartNavigation();
    else {
      setInternalNavigating(true);
      setInternalStepIndex(0);
    }
  };

  const handleStop = () => {
    if (onStopNavigation) onStopNavigation();
    else {
      setInternalNavigating(false);
    }
    speechNavigator.stop();
  };

  useEffect(() => {
    speechNavigator.setPreferences(language, isVoiceMuted);
  }, [language, isVoiceMuted]);

  const lastSpokenKeyRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!isNavigatingLive || isVoiceMuted) {
      lastSpokenKeyRef.current = null;
      speechNavigator.stop();
      return;
    }

    if (activeRoute && activeRoute.steps[currentStepIndex]) {
      const step = activeRoute.steps[currentStepIndex];
      const stepKey = `${activeRoute.id}_step_${currentStepIndex}`;
      if (lastSpokenKeyRef.current !== stepKey) {
        lastSpokenKeyRef.current = stepKey;
        speechNavigator.speak(step.instruction, step.instructionUrdu, step.instructionUrdu, step.instructionUrdu);
      }
    }
  }, [isNavigatingLive, currentStepIndex, activeRoute?.id, isVoiceMuted, language]);

  if (!destination) return null;

  // Active Navigation Screen (Driving HUD mode)
  if (isNavigatingLive) {
    const currentStep = activeRoute && activeRoute.steps[currentStepIndex];
    return (
      <div className="bg-[#143C35] text-white rounded-3xl shadow-2xl border border-emerald-500/40 p-4 sm:p-5 space-y-4">
        {/* Top Header Status: Speed, Re-centre, Voice Mute */}
        <div className="flex items-center justify-between border-b border-emerald-900/50 pb-3">
          <div className="flex items-center gap-2 font-black text-emerald-300 text-sm">
            <Gauge className="w-5 h-5 animate-pulse" />
            <span>{simulatedSpeed} {t.kmh}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Re-centre GPS Button */}
            <button
              type="button"
              onClick={() => {
                if (onRecenter) onRecenter();
              }}
              className="p-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-emerald-200 transition-all cursor-pointer shadow-sm"
              title={isRtl ? 'مقام پر واپس جائیں' : 'Re-centre on GPS'}
            >
              <Compass className="w-4 h-4" />
            </button>

            {/* Voice Mute Control */}
            <button
              type="button"
              onClick={() => setIsVoiceMuted(!isVoiceMuted)}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isVoiceMuted ? 'bg-amber-600 text-white' : 'bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200'
              }`}
              title={isVoiceMuted ? 'Unmute voice' : 'Mute voice'}
            >
              {isVoiceMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Incident Report Action */}
            {onReportIncident && (
              <button
                type="button"
                onClick={onReportIncident}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                title="Report Hazard"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>{isRtl ? 'رپورٹ' : 'Report'}</span>
              </button>
            )}

            {/* Exit Navigation Control */}
            <button
              type="button"
              onClick={handleStop}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
            >
              {t.stopNavigation}
            </button>
          </div>
        </div>

        {/* Large Next-Turn Instruction & Distance */}
        {currentStep && (
          <div className="space-y-2 py-2">
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-black uppercase tracking-wider">
              <CornerUpRight className="w-5 h-5 text-amber-400 animate-bounce" />
              <span>In {currentStep.distanceMeters}m</span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-white leading-snug">
              {isRtl ? currentStep.instructionUrdu : currentStep.instruction}
            </p>
          </div>
        )}

        {/* Remaining Distance & ETA */}
        <div className="flex items-center justify-between bg-emerald-950/60 p-3 rounded-2xl border border-emerald-500/30 text-xs font-bold text-emerald-200">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>ETA: {activeRoute?.durationMinutes || 15} Mins</span>
          </div>
          <div>
            <span>Remaining: {activeRoute?.distanceKm || 5.0} km</span>
          </div>
        </div>
      </div>
    );
  }

  // Route Planning Screen
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 space-y-4">
      {/* Origin -> Destination Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
            <span className="font-semibold truncate max-w-[240px]">
              {originMode === 'current'
                ? (userLocation ? (isRtl ? 'موجودہ جی پی ایس مقام' : 'Current GPS Location') : (isRtl ? 'GPS مقام غیر دستیاب' : 'GPS Location Unavailable'))
                : originMode === 'manual'
                ? (isRtl ? 'دستی طور پر منتخب کردہ مقام' : 'Manually Selected Location')
                : (isRtl ? 'نقشے پر منتخب کردہ نقطہ' : 'Selected Point on Map')}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm" />
            <span className="truncate max-w-[260px]">
              {isRtl ? destination.nameUrdu : destination.name}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClearNavigation}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800"
          title={t.clearRoute}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Starting Point Option Selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
          {isRtl ? 'آغاز کا مقام (Starting Point)' : 'Starting Point Option'}
        </label>
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              if (onOriginModeChange) onOriginModeChange('current');
              setGpsValidationError(null);
            }}
            className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
              originMode === 'current' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <span>📍 {isRtl ? 'موجودہ' : 'Current'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (onOriginModeChange) onOriginModeChange('manual');
              setGpsValidationError(null);
            }}
            className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
              originMode === 'manual' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <span>✏️ {isRtl ? 'درست کریں' : 'Manual'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (onOriginModeChange) onOriginModeChange('map');
              setGpsValidationError(null);
            }}
            className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
              originMode === 'map' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <span>🗺️ {isRtl ? 'نقشہ' : 'Map Point'}</span>
          </button>
        </div>

        {/* GPS Permission or Availability Error Banner */}
        {gpsValidationError && (
          <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-900 dark:text-rose-200 text-[11px] font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{gpsValidationError}</span>
          </div>
        )}

        {originMode === 'current' && !userLocation && !gpsValidationError && (
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 text-[11px] font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{isRtl ? 'GPS مقام تلاش کیا جا رہا ہے یا اجازت درکار ہے۔' : 'Detecting current GPS position or permission required...'}</span>
          </div>
        )}

        {originMode === 'map' && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-[11px] font-bold">
            {isRtl ? 'نقشے پر مطلوبہ نقطہ کلک کریں تاکہ آغاز مقرر ہو۔' : 'Tap any location on the map to set starting point.'}
          </div>
        )}
      </div>

      {/* Adaptive Routing Weather-Aware Toggle */}
      <div className="p-3 rounded-2xl bg-cyan-500/10 dark:bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <CloudRain className="w-5 h-5 text-cyan-600 dark:text-cyan-400 animate-pulse" />
          <div>
            <div className="font-extrabold text-slate-900 dark:text-white">
              {isRtl ? 'اڈیپٹیو روٹنگ (بارش سے بچاؤ)' : 'Adaptive Routing (Rain AI)'}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {weatherData
                ? (isRtl ? `موسم: ${weatherData.conditionUrdu} • خطرہ: ${weatherData.waterloggingRiskUrdu}` : `Weather: ${weatherData.condition} • Waterlogging Risk: ${weatherData.waterloggingRisk}`)
                : 'Prioritizing routes avoiding low-lying waterlogged underpasses'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAdaptiveRoutingActive(!isAdaptiveRoutingActive)}
          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            isAdaptiveRoutingActive
              ? 'bg-cyan-600 text-white shadow-md'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          {isAdaptiveRoutingActive ? (isRtl ? 'آن' : 'ON') : (isRtl ? 'آف' : 'OFF')}
        </button>
      </div>

      {/* Travel Mode Pills */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-bold">
        {[
          { id: 'DRIVING', label: isRtl ? 'کار' : 'Car', icon: Car },
          { id: 'TWO_WHEELER', label: isRtl ? 'موٹر سائیکل' : 'Bike', icon: Bike },
          { id: 'TRANSIT', label: isRtl ? 'میٹرو' : 'Transit', icon: Train },
          { id: 'WALKING', label: isRtl ? 'پیدل' : 'Walk', icon: Footprints }
        ].map((mode) => {
          const Icon = mode.icon;
          const isSelected = travelMode === mode.id;

          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onTravelModeChange(mode.id as TravelMode)}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-white dark:bg-slate-700 text-[#143C35] dark:text-emerald-300 shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Route Preferences (Avoid Tolls, etc.) */}
      <div className="flex items-center justify-between px-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={avoidTolls}
            onChange={(e) => setAvoidTolls(e.target.checked)}
            className="rounded accent-[#20A477] w-4 h-4"
          />
          <span>{isRtl ? 'ٹول روڈز سے بچیں' : 'Avoid Toll Roads'}</span>
        </label>
        <span className="text-[11px] text-emerald-600 font-bold">Optimized for Pakistan</span>
      </div>

      {/* Available Route Alternatives */}
      <div className="space-y-2">
        <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">
          {t.alternativeRoutes}
        </span>

        <div className="space-y-2">
          {routes.map((route) => {
            const isSelected = activeRoute?.id === route.id;

            return (
              <div
                key={route.id}
                onClick={() => onSelectRoute(route)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'border-[#20A477] bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-[#20A477]/30 shadow-md'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 hover:bg-slate-100'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base text-slate-900 dark:text-white">
                      {route.durationMinutes} {t.mins}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">
                      ({route.distanceKm.toFixed(1)} km)
                    </span>
                    {route.isRecommended && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-[#20A477] text-white">
                        {isRtl ? 'بہترین' : 'Fastest'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    via {isRtl ? route.viaUrdu : route.via}
                  </p>
                </div>

                <div className="text-right">
                  {route.trafficStatus === 'normal' ? (
                    <span className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-100 text-emerald-800">
                      {t.trafficNormal}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-1 rounded bg-amber-100 text-amber-800">
                      {t.trafficModerate}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* D3-Based Time vs. Cost Tradeoff Chart */}
      {routes && routes.length > 0 && (
        <RouteTimeCostChart
          routes={routes}
          activeRoute={activeRoute}
          onSelectRoute={onSelectRoute}
          travelMode={travelMode}
          isRtl={isRtl}
        />
      )}

      {/* One Prominent Start Navigation Action */}
      <button
        type="button"
        onClick={handleStart}
        className="w-full py-4 rounded-2xl bg-[#143C35] hover:bg-[#20A477] text-white font-black text-base shadow-xl shadow-[#143C35]/25 flex items-center justify-center gap-2.5 transition-all transform hover:scale-[1.01] cursor-pointer"
      >
        <Navigation className="w-5 h-5 text-[#F2B95D] fill-current" />
        <span>{t.startNavigation}</span>
      </button>
    </div>
  );
};

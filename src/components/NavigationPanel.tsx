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
  CloudRain
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
  simulatedSpeed: controlledSpeed
}) => {
  const { language, isRtl, t } = useMobilityTheme();
  const [internalNavigating, setInternalNavigating] = useState(false);
  const [internalStepIndex, setInternalStepIndex] = useState(0);
  const [internalSpeed, setInternalSpeed] = useState(42);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);

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

  const handleStep = (idx: number) => {
    if (onStepChange) onStepChange(idx);
    else setInternalStepIndex(idx);
  };

  // Synchronize speech preferences with current selected language (en, ur, pa, ar)
  useEffect(() => {
    speechNavigator.setPreferences(language, isVoiceMuted);
  }, [language, isVoiceMuted]);

  const lastSpokenKeyRef = React.useRef<string | null>(null);

  // Voice guidance trigger: Strictly speak once when currentStepIndex actually changes
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

  // Simulated GPS speedometer during active navigation if not controlled
  useEffect(() => {
    if (!isNavigatingLive || controlledSpeed !== undefined) return;
    const interval = setInterval(() => {
      setInternalSpeed(prev => {
        const delta = (Math.random() - 0.5) * 6;
        return Math.min(75, Math.max(25, Math.round(prev + delta)));
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isNavigatingLive, controlledSpeed]);

  if (!destination) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-3 sm:p-4 space-y-3">
      {/* Origin -> Destination Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-medium truncate max-w-[200px]">
              {origin ? (isRtl ? origin.nameUrdu : origin.name) : t.currentLocation}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="truncate max-w-[240px]">
              {isRtl ? destination.nameUrdu : destination.name}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClearNavigation}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          title={t.clearRoute}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Adaptive Routing Weather-Aware Toggle */}
      <div className="p-2.5 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <CloudRain className="w-4 h-4 text-cyan-600 dark:text-cyan-400 animate-pulse" />
          <div>
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>{isRtl ? 'اڈیپٹیو روٹنگ (بارش سے بچاؤ)' : 'Adaptive Routing (Rain AI)'}</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {weatherData
                ? (isRtl ? `موسم: ${weatherData.conditionUrdu} • خطرہ: ${weatherData.waterloggingRiskUrdu}` : `Weather: ${weatherData.condition} • Waterlogging Risk: ${weatherData.waterloggingRisk}`)
                : 'Prioritizing routes avoiding low-lying waterlogged underpasses'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAdaptiveRoutingActive(!isAdaptiveRoutingActive)}
          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
            isAdaptiveRoutingActive
              ? 'bg-cyan-600 text-white shadow-xs'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          {isAdaptiveRoutingActive ? (isRtl ? 'آن' : 'ON') : (isRtl ? 'آف' : 'OFF')}
        </button>
      </div>

      {/* Travel Mode Pills */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
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
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                isSelected
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Alternative Route Options */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
          {t.alternativeRoutes}
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {routes.map((route) => {
            const isSelected = activeRoute?.id === route.id;

            return (
              <div
                key={route.id}
                onClick={() => onSelectRoute(route)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {route.durationMinutes} {t.mins}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      ({route.distanceKm.toFixed(1)} km)
                    </span>
                    {route.isRecommended && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                        {isRtl ? 'بہترین' : 'Fastest'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    via {isRtl ? route.viaUrdu : route.via}
                  </p>
                </div>

                <div className="text-right">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      route.trafficStatus === 'normal'
                        ? 'bg-emerald-100 text-emerald-800'
                        : route.trafficStatus === 'heavy'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {route.trafficStatus === 'normal' ? t.trafficNormal : t.trafficModerate}
                  </span>
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

      {/* Real-time Route Altitude & Incline Visualizer */}
      {activeRoute && (
        <>
          <RouteElevationVisualizer
            route={activeRoute}
            isRtl={isRtl}
          />
          <TrafficCongestionChart
            route={activeRoute}
            isRtl={isRtl}
          />
        </>
      )}

      {/* Active Navigation Mode / Turn Guidance */}
      {isNavigatingLive ? (
        <div className="p-3 bg-slate-900 text-white rounded-xl shadow-lg space-y-2">
          {/* Top HUD: Speed & Voice Mute */}
          <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Gauge className="w-4 h-4" />
              <span>{simulatedSpeed} {t.kmh}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsVoiceMuted(!isVoiceMuted)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                title={isVoiceMuted ? 'Unmute Voice' : 'Mute Voice'}
              >
                {isVoiceMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>

              <button
                type="button"
                onClick={handleStop}
                className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
              >
                {t.stopNavigation}
              </button>
            </div>
          </div>

          {/* Current Step Instruction */}
          {activeRoute && activeRoute.steps[currentStepIndex] && (
            <div className="py-1">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <CornerUpRight className="w-4 h-4" />
                <span>Next Maneuver ({activeRoute.steps[currentStepIndex].distanceMeters}m)</span>
              </div>
              <p className="text-base sm:text-lg font-bold mt-1">
                {isRtl
                  ? activeRoute.steps[currentStepIndex].instructionUrdu
                  : activeRoute.steps[currentStepIndex].instruction}
              </p>
            </div>
          )}

          {/* Step stepper buttons */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <button
              type="button"
              disabled={currentStepIndex === 0}
              onClick={() => handleStep(Math.max(0, currentStepIndex - 1))}
              className="disabled:opacity-30 hover:text-white cursor-pointer"
            >
              Previous Step
            </button>
            <span>
              Step {currentStepIndex + 1} of {activeRoute?.steps.length || 1}
            </span>
            <button
              type="button"
              disabled={!activeRoute || currentStepIndex >= activeRoute.steps.length - 1}
              onClick={() => handleStep(currentStepIndex + 1)}
              className="disabled:opacity-30 hover:text-white cursor-pointer"
            >
              Next Step
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleStart}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Navigation className="w-4 h-4 fill-current" />
          <span>{t.startNavigation}</span>
        </button>
      )}
    </div>
  );
};

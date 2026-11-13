/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RouteOption, TravelMode, LocationPoint } from '../types';
import { useMobilityTheme } from './ThemeLayoutWrapper';
import { WeatherData } from '../services/weatherService';
import { Navigation, Car, Bike, Footprints, X, Clock, CloudRain, AlertTriangle, Loader2 } from 'lucide-react';
import { RouteTimeCostChart } from './RouteTimeCostChart';

interface NavigationPanelProps {
  destination: LocationPoint | null;
  activeRoute: RouteOption | null;
  routes: RouteOption[];
  routesLoading: boolean;
  routesSource: 'network' | 'estimate' | null;
  onSelectRoute: (id: string) => void;
  travelMode: TravelMode;
  onTravelModeChange: (mode: TravelMode) => void;
  onClearNavigation: () => void;
  hasFix: boolean;
  weatherData?: WeatherData | null;
}

export const NavigationPanel: React.FC<NavigationPanelProps> = ({
  destination, activeRoute, routes, routesLoading, routesSource, onSelectRoute, travelMode, onTravelModeChange,
  onClearNavigation, hasFix, weatherData = null
}) => {
  const { isRtl, t } = useMobilityTheme();

  if (!destination) return null;

  const fastestDuration = routes.length ? Math.min(...routes.map((r) => r.durationMinutes)) : 0;

  return (
    <div className="space-y-4">
      {/* Origin -> Destination Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
            <span className="font-semibold truncate max-w-[240px]">
              {hasFix ? (isRtl ? 'موجودہ جی پی ایس مقام' : 'Current GPS Location') : (isRtl ? 'GPS مقام غیر دستیاب' : 'GPS Location Unavailable')}
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

      {!hasFix && (
        <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 text-[11px] font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{isRtl ? 'GPS مقام تلاش کیا جا رہا ہے یا اجازت درکار ہے۔' : 'Waiting for a GPS fix (location permission required). Routes start from the city centre until then.'}</span>
        </div>
      )}

      {weatherData && (
        <div className="p-3 rounded-2xl bg-cyan-500/10 dark:bg-cyan-500/15 border border-cyan-500/30 flex items-center gap-2.5 text-xs">
          <CloudRain className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0" />
          <p className="text-[11px] text-slate-600 dark:text-slate-300">
            {isRtl
              ? `موسم: ${weatherData.conditionUrdu} • ${weatherData.temperatureC}°C • پانی جمع ہونے کا خطرہ: ${weatherData.waterloggingRiskUrdu}`
              : `Weather: ${weatherData.condition}, ${weatherData.temperatureC}°C • Waterlogging risk: ${weatherData.waterloggingRisk}`}
          </p>
        </div>
      )}

      {/* Travel Mode Pills */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-bold">
        {[
          { id: 'DRIVING', label: isRtl ? 'کار' : 'Car', icon: Car },
          { id: 'TWO_WHEELER', label: isRtl ? 'موٹر سائیکل' : 'Bike', icon: Bike },
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

      {/* Available Route Alternatives */}
      <div className="space-y-2">
        <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">
          {t.alternativeRoutes}
        </span>

        {routesLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" />{isRtl ? 'راستے تلاش ہو رہے ہیں…' : 'Finding routes…'}</div>
        )}
        {routesSource === 'estimate' && !routesLoading && (
          <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 text-[11px] font-bold">
            {isRtl ? 'سڑک کا ڈیٹا دستیاب نہیں؛ صرف اندازہ دکھایا جا رہا ہے۔' : 'Road routing unavailable, showing a rough estimate only.'}
          </div>
        )}
        <div className="space-y-2">
          {routes.map((route) => {
            const isSelected = activeRoute?.id === route.id;

            return (
              <div
                key={route.id}
                onClick={() => onSelectRoute(route.id)}
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
                    {routes.length > 1 && route.durationMinutes === fastestDuration && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-[#20A477] text-white">
                        {isRtl ? 'بہترین' : 'Fastest'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    {isRtl ? route.viaUrdu : route.via}
                  </p>
                </div>

                <div className="text-right">
                  {!route.trafficStatus ? null : route.trafficStatus === 'normal' ? (
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
      {routes.length > 1 && (
        <RouteTimeCostChart
          routes={routes}
          activeRoute={activeRoute}
          onSelectRoute={(r) => onSelectRoute(r.id)}
          travelMode={travelMode}
          isRtl={isRtl}
        />
      )}

    </div>
  );
};

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
  /** Name of a custom start point; omit when starting from my location. */
  originName?: string;
  weatherData?: WeatherData | null;
}

export const NavigationPanel: React.FC<NavigationPanelProps> = ({
  destination, activeRoute, routes, routesLoading, routesSource, onSelectRoute, travelMode, onTravelModeChange,
  onClearNavigation, hasFix, originName, weatherData = null
}) => {
  const { isRtl, t } = useMobilityTheme();

  if (!destination) return null;

  const fastestDuration = routes.length ? Math.min(...routes.map((r) => r.durationMinutes)) : 0;

  return (
    <div className="space-y-4">
      {/* Origin -> Destination Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[color:var(--line)] pb-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 text-[13px] text-[color:var(--ink-2)]">
            <span className="w-2.5 h-2.5 rounded-full border-[3px] border-[color:var(--brand-hi)] shrink-0" />
            <span className="font-semibold truncate max-w-[240px]">
              {originName ? originName : hasFix ? (isRtl ? 'آپ کا مقام' : 'Your location') : (isRtl ? 'GPS کا انتظار' : 'Waiting for GPS')}
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-[15px] font-extrabold text-[color:var(--ink)]">
            <span className="w-2.5 h-2.5 rounded-[3px] bg-[color:var(--ink)] rotate-45 shrink-0" />
            <span className="truncate max-w-[260px]">
              {isRtl ? destination.nameUrdu : destination.name}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClearNavigation}
          className="ui-btn ui-btn-soft w-9 h-9 p-0 text-[color:var(--ink-2)]" aria-label={t.clearRoute}
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
          <p className="text-[11px] text-[color:var(--ink-2)]">
            {isRtl
              ? `موسم: ${weatherData.conditionUrdu} • ${weatherData.temperatureC}°C • پانی جمع ہونے کا خطرہ: ${weatherData.waterloggingRiskUrdu}`
              : `Weather: ${weatherData.condition}, ${weatherData.temperatureC}°C • Waterlogging risk: ${weatherData.waterloggingRisk}`}
          </p>
        </div>
      )}

      {/* Travel Mode Pills */}
      <div className="ui-seg" role="group">
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
              aria-pressed={isSelected}
            >
              <Icon className="w-4 h-4" />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Available Route Alternatives */}
      <div className="space-y-2">
        <span className="ui-sub font-bold block">
          {t.alternativeRoutes}
        </span>

        {routesLoading && (
          <div className="flex items-center gap-2 ui-sub"><Loader2 className="w-4 h-4 animate-spin" />{isRtl ? 'راستے تلاش ہو رہے ہیں…' : 'Finding routes…'}</div>
        )}
        {routesSource === 'estimate' && !routesLoading && (
          <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 text-[11px] font-bold">
            {isRtl ? 'سڑک کا ڈیٹا دستیاب نہیں؛ صرف اندازہ دکھایا جا رہا ہے۔' : 'Road routing unavailable, showing a rough estimate only.'}
          </div>
        )}
        <div className="space-y-2">
          {routes.map((route, i) => {
            const isSelected = activeRoute?.id === route.id;

            return (
              <div
                key={route.id}
                style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                onClick={() => onSelectRoute(route.id)}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectRoute(route.id); }}
                className={`animate-in px-4 py-3.5 rounded-[20px] border-2 transition-[background-color,border-color,transform] duration-200 cursor-pointer flex items-center justify-between active:scale-[0.99] ${
                  isSelected
                    ? 'border-[color:var(--ink)] bg-[color:var(--surface)] shadow-[0_10px_24px_-14px_rgba(14,26,20,0.55)]'
                    : 'border-transparent bg-[color:var(--paper)] hover:border-[color:var(--line)]'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-display num text-[22px] font-extrabold text-[color:var(--ink)] leading-none">
                      {route.durationMinutes} {t.mins}
                    </span>
                    <span className="num text-xs text-[color:var(--ink-2)] font-bold">
                      · {route.distanceKm.toFixed(1)} km
                    </span>
                    {routes.length > 1 && route.durationMinutes === fastestDuration && (
                      <span className="ui-signal text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                        {isRtl ? 'بہترین' : 'Fastest'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[color:var(--ink-2)] font-medium">
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

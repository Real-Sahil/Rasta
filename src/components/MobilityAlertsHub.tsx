/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CloudRain, Wind, ShieldAlert, Zap, AlertTriangle, ChevronDown, ChevronUp, X, Bell } from 'lucide-react';
import { CityAqiData } from '../services/aqiService';
import { WeatherData } from '../services/weatherService';
import { CommunityIncident } from '../types';

interface MobilityAlertsHubProps {
  aqiData: CityAqiData | null;
  weatherData: WeatherData | null;
  isMonsoonMode: boolean;
  activeCameraRadar?: { name: string; nameUrdu: string; limit: number } | null;
  nearbyHotspot?: { incident: CommunityIncident; distanceKm: number } | null;
  isRtl?: boolean;
  onFocusIncident?: (incident: CommunityIncident) => void;
}

export const MobilityAlertsHub: React.FC<MobilityAlertsHubProps> = ({
  aqiData,
  weatherData,
  isMonsoonMode,
  activeCameraRadar,
  nearbyHotspot,
  isRtl = false,
  onFocusIncident
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedHotspot, setDismissedHotspot] = useState(false);

  const totalActiveAlerts = 
    (aqiData ? 1 : 0) +
    (weatherData?.isHeavyRain ? 1 : 0) +
    (isMonsoonMode ? 1 : 0) +
    (activeCameraRadar ? 1 : 0) +
    (nearbyHotspot && !dismissedHotspot ? 1 : 0);

  if (totalActiveAlerts === 0) return null;

  return (
    <div className="absolute top-20 left-3 lg:left-4 z-25 pointer-events-auto">
      {/* Compact Pill Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-full shadow-xl flex items-center gap-2 text-xs font-bold transition-all cursor-pointer border-2 border-white/80"
          title="Active Alerts & Advisories"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          <Bell className="w-3.5 h-3.5 fill-white" />
          <span>{isRtl ? `${totalActiveAlerts} الرٹس` : `${totalActiveAlerts} Alerts`}</span>
        </button>

        {/* Expanded Popup Drawer */}
        {isOpen && (
          <div className="absolute top-full mt-2 left-0 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3.5 z-50 space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                {isRtl ? 'فعال الرٹس اور ایڈوائزری' : 'Active Mobility Advisories'}
              </span>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
              {/* Hotspot Proximity Alert */}
              {nearbyHotspot && !dismissedHotspot && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="font-bold flex items-center gap-1 text-rose-600 dark:text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 animate-bounce" />
                      <span>{isRtl ? 'قریبی ٹریفک ہاٹ اسپاٹ' : 'Traffic Hotspot Nearby'}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 dark:text-slate-200">
                      {isRtl ? nearbyHotspot.incident.titleUrdu : nearbyHotspot.incident.title}{' '}
                      ({nearbyHotspot.distanceKm < 1 ? Math.round(nearbyHotspot.distanceKm * 1000) + 'm' : nearbyHotspot.distanceKm.toFixed(1) + 'km'})
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {onFocusIncident && (
                      <button
                        onClick={() => onFocusIncident(nearbyHotspot.incident)}
                        className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold"
                      >
                        {isRtl ? 'نقشہ' : 'Map'}
                      </button>
                    )}
                    <button
                      onClick={() => setDismissedHotspot(true)}
                      className="p-1 text-rose-400 hover:text-rose-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Speed Camera / Radar Alert */}
              {activeCameraRadar && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="font-bold flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Zap className="w-3.5 h-3.5 shrink-0" />
                      <span>{isRtl ? 'اسپیڈ کیمرہ ریڈار' : 'Speed Camera / Radar'}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 dark:text-slate-200">
                      {isRtl ? activeCameraRadar.nameUrdu : activeCameraRadar.name} • Limit: {activeCameraRadar.limit} km/h
                    </p>
                  </div>
                </div>
              )}

              {/* Monsoon Waterlogging Advisory */}
              {isMonsoonMode && (
                <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-900 text-cyan-800 dark:text-cyan-200 flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="font-bold flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
                      <CloudRain className="w-3.5 h-3.5 shrink-0" />
                      <span>{isRtl ? 'مون سون فلڈ بائی پاس فعال' : 'Monsoon Flood Bypasses Active'}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 dark:text-cyan-100">
                      {isRtl ? 'نشیبی انڈرپاسز سے بچنے کے لیے سرفیس روٹس پر رہنمائی جاری ہے۔' : 'Routing via surface slip roads to avoid low-lying underpasses.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Air Quality Index / Smog Advisory */}
              {aqiData && (
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="font-bold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Wind className="w-3.5 h-3.5 shrink-0" />
                      <span>{isRtl ? 'ایئر کوالٹی انڈیکس (AQI)' : 'Air Quality Index (AQI)'}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      AQI {aqiData.aqi} • {isRtl ? aqiData.statusUrdu : aqiData.status} (PM2.5: {aqiData.pm25} µg/m³)
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

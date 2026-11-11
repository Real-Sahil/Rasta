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
    <div className="absolute top-3 right-3 lg:top-4 lg:right-4 z-25 max-w-xs w-full pointer-events-auto">
      {/* Compact Collapsed Pill */}
      <div className="bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-xl border border-slate-700/80 overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3.5 py-2 flex items-center justify-between gap-2 text-xs font-bold cursor-pointer hover:bg-slate-800/80 transition-colors"
        >
          <div className="flex items-center gap-2 truncate">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">
              {isRtl ? `${totalActiveAlerts} فعال الرٹس اور ایڈوائزری` : `${totalActiveAlerts} Active Alerts & Advisories`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-amber-300 font-extrabold">
              {isOpen ? (isRtl ? 'بند کریں' : 'Collapse') : (isRtl ? 'دیکھیں' : 'View Hub')}
            </span>
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {/* Expanded Notifications Drawer */}
        {isOpen && (
          <div className="p-3 border-t border-slate-800 space-y-2.5 max-h-72 overflow-y-auto text-xs animate-in fade-in duration-200">
            {/* Hotspot Proximity Alert */}
            {nearbyHotspot && !dismissedHotspot && (
              <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-bold flex items-center gap-1 text-rose-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 animate-bounce" />
                    <span>{isRtl ? 'قریبی ٹریفک ہاٹ اسپاٹ' : 'Traffic Hotspot Nearby'}</span>
                  </div>
                  <p className="text-[11px] text-white">
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
                    className="p-1 text-rose-300 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Speed Camera / Radar Alert */}
            {activeCameraRadar && (
              <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-bold flex items-center gap-1 text-amber-400">
                    <Zap className="w-3.5 h-3.5 shrink-0" />
                    <span>{isRtl ? 'اسپیڈ کیمرہ ریڈار' : 'Speed Camera / Radar'}</span>
                  </div>
                  <p className="text-[11px] text-white">
                    {isRtl ? activeCameraRadar.nameUrdu : activeCameraRadar.name} • Limit: {activeCameraRadar.limit} km/h
                  </p>
                </div>
              </div>
            )}

            {/* Monsoon Waterlogging Advisory */}
            {isMonsoonMode && (
              <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/50 text-cyan-200 flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-bold flex items-center gap-1 text-cyan-400">
                    <CloudRain className="w-3.5 h-3.5 shrink-0" />
                    <span>{isRtl ? 'مون سون فلڈ بائی پاس فعال' : 'Monsoon Flood Bypasses Active'}</span>
                  </div>
                  <p className="text-[11px] text-cyan-100">
                    {isRtl ? 'نشیبی انڈرپاسز سے بچنے کے لیے سرفیس روٹس پر رہنمائی جاری ہے۔' : 'Routing via surface slip roads to avoid low-lying underpasses.'}
                  </p>
                </div>
              </div>
            )}

            {/* Air Quality Index / Smog Advisory */}
            {aqiData && (
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-bold flex items-center gap-1 text-emerald-400">
                    <Wind className="w-3.5 h-3.5 shrink-0" />
                    <span>{isRtl ? 'ایئر کوالٹی انڈیکس (AQI)' : 'Air Quality Index (AQI)'}</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    AQI {aqiData.aqi} • {isRtl ? aqiData.statusUrdu : aqiData.status} (PM2.5: {aqiData.pm25} µg/m³)
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

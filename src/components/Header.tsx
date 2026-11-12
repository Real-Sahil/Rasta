/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useMobilityTheme } from './ThemeLayoutWrapper';
import { Language } from '../types';
import { SyncStatusInfo } from '../services/incidentSyncService';
import { Compass, Moon, Sun, ShieldAlert, Globe, Layers, Navigation, Wifi, WifiOff, RefreshCw, CloudRain, Zap, Wind } from 'lucide-react';
import { fetchCityAqi, CityAqiData } from '../services/aqiService';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentCity: string;
  onCityChange: (city: string) => void;
  onEmergencyClick: () => void;
  syncInfo?: SyncStatusInfo;
  isMonsoonMode: boolean;
  onToggleMonsoon: () => void;
  isOledNightMode: boolean;
  onToggleOledNight: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentCity,
  onCityChange,
  onEmergencyClick,
  syncInfo,
  isMonsoonMode,
  onToggleMonsoon,
  isOledNightMode,
  onToggleOledNight
}) => {
  const { language, setLanguage, theme, toggleTheme, isRtl, t } = useMobilityTheme();
  const [aqiData, setAqiData] = React.useState<CityAqiData | null>(null);

  React.useEffect(() => {
    fetchCityAqi(currentCity).then(res => setAqiData(res));
  }, [currentCity]);

  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
        {/* Brand & City */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-700 via-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
            <Compass className="w-5 h-5 animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900 dark:text-white tracking-tight text-base md:text-lg">
                {isRtl ? 'راستہ پاکستان' : 'RASTA'}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                PK
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <select
                value={currentCity}
                onChange={(e) => onCityChange(e.target.value)}
                className="bg-transparent font-medium hover:text-emerald-600 focus:outline-none cursor-pointer"
              >
                <option value="lahore">Lahore (لاہور) - Live</option>
                <option value="karachi">Karachi (کراچی)</option>
                <option value="islamabad">Islamabad (اسلام آباد)</option>
                <option value="rawalpindi">Rawalpindi (راولپنڈی)</option>
              </select>

              {/* Air Quality Index (AQI) / Smog Badge */}
              {aqiData && (
                <div className={`hidden xs:flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black ${aqiData.colorClass} shadow-xs`} title={`PM2.5: ${aqiData.pm25} µg/m³`}>
                  <Wind className="w-3 h-3" />
                  <span>AQI {aqiData.aqi}</span>
                  <span className="hidden lg:inline">({isRtl ? aqiData.statusUrdu : aqiData.status})</span>
                </div>
              )}

              {/* IndexedDB Community Background Sync Indicator */}
              {syncInfo && (
                <span
                  className={`hidden md:flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold transition-all ${
                    syncInfo.isOnline
                      ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                  }`}
                  title={
                    syncInfo.isOnline
                      ? 'Community incidents live synced via IndexedDB'
                      : 'Offline: reports cached in IndexedDB will auto-sync on reconnect'
                  }
                >
                  {syncInfo.isOnline ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{syncInfo.pendingSyncCount > 0 ? `Syncing (${syncInfo.pendingSyncCount})` : 'IndexedDB Sync'}</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3 text-amber-600" />
                      <span>Offline (Cached)</span>
                    </>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* PWA Install Button (Optional Feature) */}
          <PWAInstallButton isRtl={isRtl} />

          {/* Professional Rasta HD Vector & Satellite Engine Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{isRtl ? 'راستہ ایچ ڈی انجن' : 'Rasta HD Engine'}</span>
          </div>

          {/* Emergency 1122 Quick SOS Dial */}
          <button
            type="button"
            onClick={onEmergencyClick}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs font-bold hover:bg-rose-100 transition-all shadow-xs"
            title="Emergency 1122 & Roadside Help"
          >
            <ShieldAlert className="w-4 h-4 text-rose-600 animate-bounce" />
            <span className="hidden xs:inline">1122 SOS</span>
          </button>

          {/* Multilingual Selector */}
          <div className="relative flex items-center">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="appearance-none pl-2.5 pr-6 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none transition-all"
            >
              <option value="en">English</option>
              <option value="ur">اردو (Urdu)</option>
              <option value="pa">پنجابی (Punjabi)</option>
              <option value="ar">العربية</option>
            </select>
            <Globe className="w-3.5 h-3.5 absolute right-2 pointer-events-none text-slate-400" />
          </div>

          {/* Monsoon Flood Bypasses Toggle */}
          <button
            type="button"
            onClick={onToggleMonsoon}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isMonsoonMode
                ? 'bg-cyan-600 text-white border-cyan-700 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
            }`}
            title={isMonsoonMode ? 'Monsoon Flood Bypasses: ON' : 'Monsoon Flood Bypasses: OFF'}
          >
            <CloudRain className="w-4 h-4" />
          </button>

          {/* OLED Night Cockpit Mode Toggle */}
          <button
            type="button"
            onClick={onToggleOledNight}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isOledNightMode
                ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400 shadow-lg'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
            }`}
            title={isOledNightMode ? 'OLED Night Cockpit Mode: ON' : 'OLED Night Cockpit Mode: OFF'}
          >
            <Zap className="w-4 h-4" />
          </button>

          {/* Theme Mode Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Night Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </div>
    </header>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useMobilityTheme } from './ThemeLayoutWrapper';
import { Language } from '../types';
import { SyncStatusInfo } from '../services/incidentSyncService';
import { Moon, Sun, ShieldAlert, CloudRain, Zap, Wind } from 'lucide-react';
import { fetchCityAqi, CityAqiData } from '../services/aqiService';

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
  const { language, setLanguage, theme, toggleTheme, isRtl } = useMobilityTheme();
  const [aqiData, setAqiData] = React.useState<CityAqiData | null>(null);

  React.useEffect(() => {
    fetchCityAqi(currentCity).then(res => setAqiData(res));
  }, [currentCity]);

  return (
    <header className="shrink-0 z-30 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-3">
        {/* Brand & City */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-700 via-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0 overflow-hidden">
            <img src="/buraq-icon.png" alt="Buraq" className="w-full h-full object-cover" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900 dark:text-white tracking-tight text-sm sm:text-base truncate">
                {isRtl ? 'براق پاکستان' : 'BURAQ'}
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 shrink-0">
                PK
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <select
                value={currentCity}
                onChange={(e) => onCityChange(e.target.value)}
                className="bg-transparent font-medium hover:text-emerald-600 focus:outline-none cursor-pointer truncate max-w-[130px]"
              >
                <option value="lahore">Lahore (لاہور)</option>
                <option value="karachi">Karachi (کراچی)</option>
                <option value="islamabad">Islamabad (اسلام آباد)</option>
                <option value="rawalpindi">Rawalpindi (راولپنڈی)</option>
                <option value="multan">Multan (ملتان)</option>
                <option value="faisalabad">Faisalabad (فیصل آباد)</option>
              </select>

              {/* AQI Badge */}
              {aqiData && (
                <div className={`hidden md:flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black ${aqiData.colorClass} shadow-xs`}>
                  <Wind className="w-3 h-3" />
                  <span>AQI {aqiData.aqi}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls - Cleanly Spaced to Prevent Overlaps and Mis-clicks */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Multilingual Selector */}
          <div className="relative flex items-center">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none transition-all shadow-xs"
              title="Select Language"
            >
              <option value="en">English</option>
              <option value="ur">اردو</option>
              <option value="pa">پنجابی</option>
              <option value="ar">العربية</option>
            </select>
          </div>

          {/* Emergency 1122 Quick SOS Dial */}
          <button
            type="button"
            onClick={onEmergencyClick}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs font-bold hover:bg-rose-100 transition-all shadow-xs shrink-0"
            title="Emergency 1122 & Roadside Help"
          >
            <ShieldAlert className="w-4 h-4 text-rose-600 animate-bounce shrink-0" />
            <span className="hidden xs:inline">1122</span>
          </button>

          {/* Secondary Toggles (Hidden on very small screens to eliminate crowding) */}
          <div className="hidden sm:flex items-center gap-1.5">
            {/* Monsoon Flood Bypasses Toggle */}
            <button
              type="button"
              onClick={onToggleMonsoon}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isMonsoonMode
                  ? 'bg-cyan-600 text-white border-cyan-700 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }`}
              title={isMonsoonMode ? 'Monsoon advisory: ON' : 'Monsoon advisory: OFF'}
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
          </div>

          {/* Theme Mode Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors shrink-0"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Night Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </div>
    </header>
  );
};

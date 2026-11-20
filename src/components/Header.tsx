/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useMobilityTheme } from './ThemeLayoutWrapper';
import { Language } from '../types';
import { SyncStatusInfo } from '../services/incidentSyncService';
import { SkinPicker } from './SkinPicker';
import { Moon, Sun, ShieldAlert, CloudRain, Zap, Wind, Info } from 'lucide-react';
import { fetchCityAqi, CityAqiData } from '../services/aqiService';
import { PK_CITIES } from '../data/pakistanLocations';

interface HeaderProps {
  currentCity: string;
  onCityChange: (city: string) => void;
  onEmergencyClick: () => void;
  syncInfo?: SyncStatusInfo;
  isMonsoonMode: boolean;
  onToggleMonsoon: () => void;
  isOledNightMode: boolean;
  onToggleOledNight: () => void;
  onLegalClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentCity,
  onCityChange,
  onEmergencyClick,
  syncInfo,
  isMonsoonMode,
  onToggleMonsoon,
  isOledNightMode,
  onToggleOledNight,
  onLegalClick
}) => {
  const { language, setLanguage, theme, toggleTheme, isRtl, t } = useMobilityTheme();
  const [aqiData, setAqiData] = React.useState<CityAqiData | null>(null);

  React.useEffect(() => {
    fetchCityAqi(currentCity).then(res => setAqiData(res));
  }, [currentCity]);

  // One row: brand + city on the left, SOS and a few quiet controls on the right. Secondary
  // toggles (monsoon, night cockpit) only show on wider screens.
  const quiet = 'ui-btn ui-btn-soft w-9 h-9 p-0 shrink-0';
  return (
    <header className="skin-header ui-glass relative shrink-0 z-30 w-full !rounded-none !border-x-0 !border-t-0">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-[96px]">
          <img src="/icons/icon-192.png" alt="" className="w-9 h-9 rounded-[12px] shadow-sm shrink-0" />
          <div className="min-w-0 leading-tight">
            <span className="skin-display font-display block text-base font-extrabold text-[color:var(--ink)] truncate">
              {isRtl ? 'براق' : 'Buraq'}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-[color:var(--ink-2)]">
              <select
                value={currentCity}
                onChange={(e) => onCityChange(e.target.value)}
                aria-label={isRtl ? 'شہر' : 'City'}
                className="bg-transparent font-semibold text-[color:var(--ink-2)] hover:text-[color:var(--ink)] focus:outline-none cursor-pointer truncate max-w-[112px]"
              >
                {PK_CITIES.map((c) => <option key={c.id} value={c.id}>{isRtl ? c.ur : c.en}</option>)}
              </select>
              {aqiData && (
                <span className={`num inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${aqiData.colorClass}`}>
                  <Wind className="w-3 h-3" />AQI {aqiData.aqi}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            aria-label="Language"
            title="Select Language"
            className="ui-btn ui-btn-soft h-9 px-2.5 text-xs appearance-none text-center"
          >
            <option value="en">EN</option>
            <option value="ur">اردو</option>
            <option value="pa">پنجابی</option>
            <option value="ar">عربي</option>
          </select>

          <button type="button" onClick={onEmergencyClick} className="ui-btn ui-btn-danger h-9 px-2.5 gap-1 text-xs" title={isRtl ? 'ایمرجنسی 1122' : 'Emergency 1122'}>
            <ShieldAlert className="w-4 h-4" />
            <span className="num">1122</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5">
            <button type="button" onClick={onToggleMonsoon} aria-pressed={isMonsoonMode} className={`${quiet} ${isMonsoonMode ? '!bg-cyan-600 !text-white' : ''}`} title={isMonsoonMode ? 'Monsoon advisory: on' : 'Monsoon advisory: off'}>
              <CloudRain className="w-4 h-4" />
            </button>
            <button type="button" onClick={onToggleOledNight} aria-pressed={isOledNightMode} className={`${quiet} ${isOledNightMode ? '!bg-[color:var(--ink)] !text-[color:var(--signal)]' : ''}`} title={isOledNightMode ? 'Night cockpit: on' : 'Night cockpit: off'}>
              <Zap className="w-4 h-4" />
            </button>
          </div>

          {onLegalClick && (
            <button type="button" onClick={onLegalClick} aria-label={t.legalLink} title={t.legalLink} className={quiet}>
              <Info className="w-4 h-4" />
            </button>
          )}

          <SkinPicker label={t.skinLabel} defaultLabel={t.skinDefault} isRtl={isRtl} />

          <button type="button" onClick={toggleTheme} className={quiet} title={theme === 'dark' ? 'Light mode' : 'Night mode'} aria-label={theme === 'dark' ? 'Light mode' : 'Night mode'}>
            {theme === 'dark' ? <Sun className="w-4 h-4 text-[color:var(--signal)]" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};

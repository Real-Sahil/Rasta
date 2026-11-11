/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Compass, Navigation, ShieldAlert, CloudRain, Wind, Award, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useMobilityTheme } from './ThemeLayoutWrapper';

interface LandingGatekeeperProps {
  onLaunchMap: () => void;
}

export const LandingGatekeeper: React.FC<LandingGatekeeperProps> = ({ onLaunchMap }) => {
  const { isRtl, language, setLanguage } = useMobilityTheme();
  const [hasVisited, setHasVisited] = useState(true);

  useEffect(() => {
    const visited = localStorage.getItem('rasta_visited_v1');
    if (!visited) {
      setHasVisited(false);
    }
  }, []);

  const handleLaunch = () => {
    localStorage.setItem('rasta_visited_v1', 'true');
    setHasVisited(true);
    onLaunchMap();
  };

  if (hasVisited) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto selection:bg-emerald-500 selection:text-white">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 max-w-2xl w-full mx-auto text-center space-y-6">
        {/* Brand Logo & Badge */}
        <div className="flex flex-col items-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/30 animate-smooth-breathe">
            <Compass className="w-9 h-9 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              {isRtl ? 'راستہ پاکستان' : 'RASTA PAKISTAN'}
            </h1>
            <span className="text-xs font-black px-2 py-0.5 rounded bg-emerald-500 text-slate-950">
              PK
            </span>
          </div>
          <p className="text-sm sm:text-base text-slate-300 max-w-lg mx-auto font-medium">
            {isRtl
              ? 'پاکستان کا پہلا ۱۰۰٪ مفت اور کمیونٹی سے چلنے والا موبিলিٹی انٹیلی جنس اور نیویگیشن پلیٹ فارم۔'
              : 'Pakistan-first 100% free mobility intelligence and navigation platform built for local commuters.'}
          </p>
        </div>

        {/* Value Proposition Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5 backdrop-blur-md">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <Navigation className="w-4 h-4" />
              <span>{isRtl ? 'لائیو ٹرن بائی ٹرن نیویگیشن' : 'Live Turn-by-Turn GPS'}</span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isRtl ? 'اردو، پنجابی اور عربی وائس نیویگیشن کے ساتھ درست روٹس۔' : 'Precise routing with native Urdu, Punjabi, and Arabic voice guidance.'}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5 backdrop-blur-md">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <ShieldAlert className="w-4 h-4" />
              <span>{isRtl ? 'کمیونٹی ٹریفک الرٹس' : 'Waze-Style Hazard Alerts'}</span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isRtl ? 'پولیس ناکہ، دھرنا، حادثات اور پانی جمع ہونے کی لائیو رپورٹس۔' : 'Real-time police nakas, protests, accidents, and waterlogging alerts.'}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5 backdrop-blur-md">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
              <CloudRain className="w-4 h-4" />
              <span>{isRtl ? 'مون سون فلڈ بائی پاس' : 'Monsoon Flood Bypasses'}</span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isRtl ? 'بارش کے دوران نشیبی انڈرپاسز سے بچنے کے لیے خودکار متبادل روٹس۔' : 'Automatically routes around waterlogged underpasses during heavy rain.'}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5 backdrop-blur-md">
            <div className="flex items-center gap-2 text-teal-400 font-bold text-xs">
              <Wind className="w-4 h-4" />
              <span>{isRtl ? 'ایئر کوالٹی (AQI) مانیٹرنگ' : 'Smog & AQI Monitoring'}</span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isRtl ? 'لاہور اور دیگر شہروں کے لیے لائیو سموگ اور ایئر کوالٹی انڈیکس۔' : 'Live PM2.5 and AQI tracking for Lahore, Karachi, and Islamabad.'}
            </p>
          </div>
        </div>

        {/* Launch Button & Language Selector */}
        <div className="space-y-4 pt-2">
          <button
            type="button"
            onClick={handleLaunch}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-extrabold text-base shadow-2xl shadow-emerald-500/40 flex items-center justify-center gap-2.5 transition-all transform hover:scale-[1.02] cursor-pointer"
          >
            <span>{isRtl ? 'راستہ لائیو میپ شروع کریں' : 'Launch Rasta Live Map'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <span>Choose Language:</span>
            <button
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${language === 'en' ? 'bg-slate-800 text-white' : 'hover:text-white'}`}
            >
              English
            </button>
            <button
              onClick={() => setLanguage('ur')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${language === 'ur' ? 'bg-slate-800 text-white' : 'hover:text-white'}`}
            >
              اردو
            </button>
            <button
              onClick={() => setLanguage('pa')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${language === 'pa' ? 'bg-slate-800 text-white' : 'hover:text-white'}`}
            >
              پنجابی
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

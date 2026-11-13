/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Language } from '../types';
import { getStoredIncidents } from '../services/storage';
import { WifiOff, Wifi, Database, AlertTriangle } from 'lucide-react';

interface OfflineManagerProps {
  language: Language;
}

// Honest offline status: the app caches the app shell and map tiles you have already viewed
// (ArcGIS raster styles) via the service worker. Downloadable region packs are not implemented.
export const OfflineManager: React.FC<OfflineManagerProps> = ({ language }) => {
  const isUrdu = language === 'ur' || language === 'pa' || language === 'ar';
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const incidentCount = getStoredIncidents().length;

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xl space-y-3">
      <div className={`p-3 rounded-2xl border flex items-start gap-3 ${
        isOnline
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
          : 'bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-200'
      }`}>
        {isOnline ? <Wifi className="w-5 h-5 shrink-0 text-emerald-600" /> : <WifiOff className="w-5 h-5 shrink-0 text-amber-600" />}
        <div className="text-xs font-bold">
          {isOnline
            ? (isUrdu ? 'آپ آن لائن ہیں' : 'You are online')
            : (isUrdu ? 'انٹرنیٹ دستیاب نہیں' : 'You are offline')}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
        <Database className="w-4 h-4 text-emerald-600" />
        <span>
          {isUrdu
            ? `اس ڈیوائس پر ${incidentCount} ٹریفک رپورٹس محفوظ ہیں`
            : `${incidentCount} incident report(s) stored on this device`}
        </span>
      </div>

      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2 leading-relaxed">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <span>
          {isUrdu
            ? 'ایپ اور وہ نقشہ ٹائلز جو آپ دیکھ چکے ہیں آف لائن دستیاب رہ سکتی ہیں۔ علاقائی آف لائن نقشہ پیکس ابھی دستیاب نہیں۔'
            : 'The app and map tiles you have already viewed may stay available offline. Downloadable region map packs and offline routing are not available yet.'}
        </span>
      </div>
    </div>
  );
};

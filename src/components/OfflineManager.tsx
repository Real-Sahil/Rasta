/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Language } from '../types';
import { translations } from '../data/locales';
import { OfflineAreaPack, getStoredOfflineAreas, saveStoredOfflineAreas } from '../services/storage';
import { HardDriveDownload, CheckCircle, DownloadCloud, WifiOff, MapPin, Database } from 'lucide-react';

interface OfflineManagerProps {
  language: Language;
}

export const OfflineManager: React.FC<OfflineManagerProps> = ({ language }) => {
  const t = translations[language] || translations.en;
  const isUrdu = language === 'ur' || language === 'pa';
  const [areas, setAreas] = useState<OfflineAreaPack[]>(getStoredOfflineAreas());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = (id: string) => {
    setDownloadingId(id);
    setTimeout(() => {
      const updated = areas.map(a => {
        if (a.id === id) {
          return {
            ...a,
            status: 'cached' as const,
            downloadedAt: Date.now()
          };
        }
        return a;
      });
      setAreas(updated);
      saveStoredOfflineAreas(updated);
      setDownloadingId(null);
    }, 1200);
  };

  const totalCachedMb = areas
    .filter(a => a.status === 'cached')
    .reduce((sum, a) => sum + a.sizeMb, 0)
    .toFixed(1);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <WifiOff className="w-5 h-5 text-emerald-500" />
            <span>{t.offlineMode}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Download regional map tiles and emergency road data for offline Pakistani commuting
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs font-bold self-start sm:self-auto">
          <Database className="w-3.5 h-3.5" />
          <span>{totalCachedMb} MB Cached</span>
        </div>
      </div>

      <div className="space-y-2.5">
        {areas.map((area) => (
          <div
            key={area.id}
            className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                  {isUrdu ? area.nameUrdu : area.name}
                </h4>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 pl-6">
                Size: {area.sizeMb} MB • {area.status === 'cached' ? 'Available offline' : 'Downloadable over Wi-Fi'}
              </p>
            </div>

            {area.status === 'cached' ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 rounded-lg shrink-0">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Downloaded</span>
              </span>
            ) : (
              <button
                onClick={() => handleDownload(area.id)}
                disabled={downloadingId === area.id}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>{downloadingId === area.id ? 'Caching...' : t.downloadPack}</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

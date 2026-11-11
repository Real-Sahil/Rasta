/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MultimodalCostComparison } from '../types';
import { calculateMultimodalOptions } from '../services/fareCalculator';
import { useMobilityTheme } from './ThemeLayoutWrapper';
import {
  Train,
  Bus,
  Bike,
  Car,
  Clock,
  Coins,
  CheckCircle2,
  Sparkles,
  Zap,
  GraduationCap
} from 'lucide-react';

interface MultimodalComparisonProps {
  distanceKm: number;
  durationMinutes: number;
  selectedMode: string;
  onSelectMode: (mode: string) => void;
}

export const MultimodalComparison: React.FC<MultimodalComparisonProps> = ({
  distanceKm,
  durationMinutes,
  selectedMode,
  onSelectMode
}) => {
  const { isRtl, t } = useMobilityTheme();
  const [studentDiscount, setStudentDiscount] = useState(false);

  const options = calculateMultimodalOptions(distanceKm, durationMinutes, studentDiscount);

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'orangeline':
        return <Train className="w-5 h-5 text-amber-500" />;
      case 'metrobus':
        return <Bus className="w-5 h-5 text-rose-500" />;
      case 'motorbike':
        return <Bike className="w-5 h-5 text-emerald-600" />;
      case 'car':
        return <Car className="w-5 h-5 text-sky-600" />;
      case 'rickshaw':
        return <div className="text-sm font-bold text-yellow-600">🛺</div>;
      default:
        return <Car className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
      {/* Header and Student Concession Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div>
          <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-emerald-600" />
            <span>{t.multimodalTitle}</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isRtl ? 'لاہور میں سستے اور تیز ترین سفر کا موازنہ' : 'Estimated fares for Pakistani commuters (Rs. 265/L petrol benchmark)'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setStudentDiscount(!studentDiscount)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all border ${
            studentDiscount
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>{t.studentConcession}</span>
        </button>
      </div>

      {/* Grid of Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {options.map((opt) => {
          const isSelected = selectedMode === opt.mode;

          return (
            <div
              key={opt.mode}
              onClick={() => onSelectMode(opt.mode)}
              className={`relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/30'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {/* Badges */}
              <div className="flex items-center justify-between gap-1 mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-xs">
                    {getModeIcon(opt.mode)}
                  </div>
                  <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                    {isRtl ? opt.titleUrdu : opt.title}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {opt.isCheapest && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" />
                      {t.cheapest}
                    </span>
                  )}
                  {opt.isFastest && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center gap-0.5">
                      <Zap className="w-2.5 h-2.5" />
                      {t.fastest}
                    </span>
                  )}
                </div>
              </div>

              {/* Price & Duration */}
              <div className="flex items-baseline justify-between mt-1 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    Rs. {opt.costPkr}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {opt.costPkr === 0 ? '(Free)' : '/ trip'}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{opt.durationMinutes} {t.mins}</span>
                </div>
              </div>

              {/* Bullet highlights */}
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                {(isRtl ? opt.highlightsUrdu : opt.highlights).slice(0, 2).map((h, i) => (
                  <div key={i} className="flex items-center gap-1 truncate">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">{h}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

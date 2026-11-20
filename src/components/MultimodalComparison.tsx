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
  CarTaxiFront,
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
        return <CarTaxiFront className="w-5 h-5 text-amber-600" />;
      default:
        return <Car className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-3">
      {/* Header and Student Concession Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 ">
        <div className="min-w-0 flex-1">
          <p className="ui-sub">
            {isRtl ? 'لاہور میں سستے اور تیز ترین سفر کا موازنہ' : 'Estimated fares for Pakistani commuters (Rs. 265/L petrol benchmark)'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setStudentDiscount(!studentDiscount)}
          aria-pressed={studentDiscount}
          className="ui-chip shrink-0"
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
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectMode(opt.mode); }}
              className={`relative px-4 py-3.5 rounded-[20px] border-2 transition-[background-color,border-color,transform] duration-200 cursor-pointer flex flex-col justify-between active:scale-[0.99] ${
                isSelected
                  ? 'border-[color:var(--ink)] bg-[color:var(--surface)] shadow-[0_10px_24px_-14px_rgba(14,26,20,0.55)]'
                  : 'border-transparent bg-[color:var(--paper)] hover:border-[color:var(--line)]'
              }`}
            >
              {/* Badges */}
              <div className="flex items-center justify-between gap-1 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[color:var(--surface)] ring-1 ring-[color:var(--line)] flex items-center justify-center">
                    {getModeIcon(opt.mode)}
                  </div>
                  <span className="font-bold text-xs sm:text-sm text-[color:var(--ink)]">
                    {isRtl ? opt.titleUrdu : opt.title}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {opt.isCheapest && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[color:var(--brand)] text-white flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" />
                      {t.cheapest}
                    </span>
                  )}
                  {opt.isFastest && (
                    <span className="ui-signal px-2 py-0.5 rounded-full text-[11px] font-extrabold flex items-center gap-0.5">
                      <Zap className="w-2.5 h-2.5" />
                      {t.fastest}
                    </span>
                  )}
                </div>
              </div>

              {/* Price & Duration */}
              <div className="flex items-baseline justify-between mt-1 pt-2 border-t border-[color:var(--line)]">
                <div className="flex items-baseline gap-1">
                  <span className="font-display num text-[22px] font-extrabold text-[color:var(--ink)] leading-none">
                    Rs. {opt.costPkr}
                  </span>
                  <span className="text-[11px] text-[color:var(--ink-2)]">
                    {opt.costPkr === 0 ? '(Free)' : '/ trip'}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs font-semibold text-[color:var(--ink-2)]">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="num">{opt.durationMinutes} {t.mins}</span>
                </div>
              </div>

              {/* Bullet highlights */}
              <div className="mt-2 text-[11px] text-[color:var(--ink-2)] space-y-0.5">
                {(isRtl ? opt.highlightsUrdu : opt.highlights).slice(0, 2).map((h, i) => (
                  <div key={i} className="flex items-center gap-1 truncate">
                    <span className="w-1 h-1 rounded-full bg-[color:var(--ink-2)] shrink-0" />
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

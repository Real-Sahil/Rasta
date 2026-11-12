/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Sparkles } from 'lucide-react';

interface BottomSheetProps {
  activeTab: string;
  onTabChange: (tab: any) => void;
  incidentCount: number;
  isRtl?: boolean;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  activeTab,
  onTabChange,
  incidentCount,
  isRtl = false,
  children
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getSheetTitle = () => {
    switch (activeTab) {
      case 'navigate':
        return isRtl ? 'راستہ اور نیویگیشن' : 'Route & Navigation';
      case 'multimodal':
        return isRtl ? 'ملٹی موڈل موازنہ' : 'Multimodal Comparison';
      case 'transit':
        return isRtl ? 'لاہور میٹرو اور اورنج لائن' : 'Lahore Metrobus & Orange Line';
      case 'incidents':
        return isRtl ? `کمیونٹی ٹریفک الرٹس (${incidentCount})` : `Community Road Alerts (${incidentCount})`;
      case 'emergency':
        return isRtl ? 'ایمرجنسی ۱۱۲۲ SOS' : 'Emergency 1122 & Roadside SOS';
      case 'offline':
        return isRtl ? 'آف لائن نقشے اور ریجن پیکس' : 'Offline Map Packs & P2P Mesh';
      default:
        return isRtl ? 'موبিলিٹی انٹیلی جنس' : 'Mobility Intelligence';
    }
  };

  return (
    <div className={`absolute bottom-16 inset-x-0 z-30 transition-all duration-300 ${isExpanded ? 'h-[75vh] lg:h-[calc(100vh-100px)]' : 'h-[22vh]'}`}>
      <div className="w-full h-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-emerald-900/10 dark:border-slate-800 shadow-[0_-12px_35px_rgba(20,60,53,0.12)] rounded-t-[2.5rem] flex flex-col overflow-hidden">
        {/* Drag Handle & Clean Header */}
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full pt-3 pb-2.5 px-6 flex items-center justify-between cursor-pointer shrink-0 border-b border-slate-100 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
              {getSheetTitle()}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full"></div>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-slate-400 animate-bounce" />
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
          {children}
        </div>
      </div>
    </div>
  );
};

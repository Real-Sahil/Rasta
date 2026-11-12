/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Navigation, Sparkles, Train, AlertTriangle, LifeBuoy, WifiOff, X } from 'lucide-react';

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

  return (
    <div className={`absolute bottom-0 inset-x-0 z-30 transition-all duration-300 ${isExpanded ? 'h-[72vh] lg:h-[calc(100vh-80px)]' : 'h-[20vh]'}`}>
      <div className="w-full h-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_30px_rgba(0,0,0,0.15)] rounded-t-[2.5rem] flex flex-col overflow-hidden">
        {/* Drag Handle & Mode Bar */}
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-pointer shrink-0 border-b border-slate-100 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50"
        >
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mb-2"></div>
          
          {/* Bottom Sheet Tab Bar */}
          <div className="w-full max-w-2xl px-4 flex items-center justify-around gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onTabChange('navigate'); setIsExpanded(true); }}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                activeTab === 'navigate' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Navigate</span>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onTabChange('multimodal'); setIsExpanded(true); }}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                activeTab === 'multimodal' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Multimodal</span>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onTabChange('transit'); setIsExpanded(true); }}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                activeTab === 'transit' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Train className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Metro</span>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onTabChange('incidents'); setIsExpanded(true); }}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                activeTab === 'incidents' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Alerts ({incidentCount})</span>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onTabChange('emergency'); setIsExpanded(true); }}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                activeTab === 'emergency' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">1122</span>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onTabChange('offline'); setIsExpanded(true); }}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                activeTab === 'offline' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Offline</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
};

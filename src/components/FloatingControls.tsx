/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, Compass, Layers, Plus, Minus } from 'lucide-react';

interface FloatingControlsProps {
  onReportClick: () => void;
  onRecenterClick: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  isRtl?: boolean;
}

export const FloatingControls: React.FC<FloatingControlsProps> = ({
  onReportClick,
  onRecenterClick,
  onZoomIn,
  onZoomOut,
  isRtl = false
}) => {
  return (
    <div className={`absolute ${isRtl ? 'left-4 items-start' : 'right-4 items-end'} bottom-32 z-20 flex flex-col gap-3`}>
      {/* Waze-style Hazard Report FAB */}
      <button
        type="button"
        onClick={onReportClick}
        className="w-14 h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-2xl flex items-center justify-center border-2 border-white transform hover:scale-105 active:scale-95 transition-all cursor-pointer group"
        title="Report Hazard (Waze Style)"
      >
        <AlertTriangle className="w-7 h-7 fill-white text-amber-500 group-hover:rotate-12 transition-transform" />
      </button>

      {/* Recenter GPS Button */}
      <button
        type="button"
        onClick={onRecenterClick}
        className="w-12 h-12 bg-white/95 dark:bg-slate-900/95 backdrop-blur text-slate-800 dark:text-slate-100 rounded-full shadow-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
        title="Recenter & Follow Vehicle"
      >
        <Compass className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
      </button>

      {/* Zoom Controls */}
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        <button
          type="button"
          onClick={onZoomIn}
          className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 transition-colors cursor-pointer"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

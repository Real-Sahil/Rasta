/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CommunityIncident } from '../types';
import { Flame } from 'lucide-react';

interface IncidentHeatmapLayerProps {
  incidents: CommunityIncident[];
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  isRtl?: boolean;
}

export const IncidentHeatmapLayer: React.FC<IncidentHeatmapLayerProps> = ({
  incidents,
  showHeatmap,
  onToggleHeatmap,
  isRtl = false
}) => {
  if (incidents.length === 0) return null;

  return (
    <div className="absolute top-32 right-3 z-20 flex flex-col items-end gap-1 pointer-events-auto">
      <button
        type="button"
        onClick={onToggleHeatmap}
        className={`px-3 py-1.5 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer ${
          showHeatmap
            ? 'bg-rose-600 text-white border-rose-500 shadow-rose-600/30'
            : 'bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
        }`}
        title="D3 Incident Density Heatmap (24h)"
      >
        <Flame className={`w-4 h-4 ${showHeatmap ? 'animate-bounce text-amber-300' : 'text-rose-500'}`} />
        <span>{isRtl ? (showHeatmap ? 'ہیٹ میپ: آن' : 'ہیٹ میپ') : (showHeatmap ? 'Heatmap: ON' : 'Risk Heatmap')}</span>
      </button>

      {showHeatmap && (
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-2.5 rounded-xl border border-slate-700 shadow-2xl text-[10px] space-y-1.5 max-w-[200px] animate-fade-in">
          <div className="font-bold text-amber-400 flex items-center justify-between">
            <span>{isRtl ? '۲۴ گھنٹے کا خطرہ' : '24h Risk Density'}</span>
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          </div>
          <p className="text-slate-300 text-[9.5px]">
            {isRtl
              ? 'سرخ حلقے حادثات اور پانی جمع ہونے کے زیادہ خطرے والے زونز کی نشاندہی کرتے ہیں۔'
              : 'Glowing gradient nodes aggregate high-density congestion and accident reports over the last 24h.'}
          </p>
          <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[9px] text-slate-400">
            <span>Low Risk</span>
            <span className="bg-gradient-to-r from-amber-400 to-rose-600 w-16 h-2 rounded-full inline-block"></span>
            <span>High Risk</span>
          </div>
        </div>
      )}
    </div>
  );
};

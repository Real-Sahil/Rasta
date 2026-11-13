/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, LocateFixed } from 'lucide-react';

interface FloatingControlsProps {
  onReportClick?: () => void;
  onLocateClick: () => void;
  isRtl?: boolean;
}

/** Report + locate buttons. Rendered inside the sheet's `floating` slot so they never collide with it. */
export const FloatingControls: React.FC<FloatingControlsProps> = ({ onReportClick, onLocateClick, isRtl = false }) => (
  <>
    {onReportClick && (
      <button
        type="button"
        onClick={onReportClick}
        aria-label={isRtl ? 'سڑک کی رپورٹ' : 'Report a road hazard'}
        className="w-12 h-12 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-xl flex items-center justify-center border-2 border-white cursor-pointer"
      >
        <AlertTriangle className="w-6 h-6" />
      </button>
    )}
    <button
      type="button"
      onClick={onLocateClick}
      aria-label={isRtl ? 'میرا مقام' : 'My location'}
      className="w-12 h-12 bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer"
    >
      <LocateFixed className="w-5 h-5" />
    </button>
  </>
);

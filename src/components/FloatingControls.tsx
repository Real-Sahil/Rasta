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
        className="ui-btn ui-glass w-12 h-12 p-0 text-[color:var(--ink)]"
      >
        <AlertTriangle className="w-5 h-5 fill-[color:var(--signal)] stroke-[color:var(--ink)]" />
      </button>
    )}
    <button
      type="button"
      onClick={onLocateClick}
      aria-label={isRtl ? 'میرا مقام' : 'My location'}
      className="ui-btn ui-glass w-12 h-12 p-0 text-[color:var(--brand)] dark:text-[color:var(--brand-hi)]"
    >
      <LocateFixed className="w-5 h-5" />
    </button>
  </>
);

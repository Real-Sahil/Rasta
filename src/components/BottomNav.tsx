/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Navigation, Scale, Train, AlertTriangle, ShieldAlert } from 'lucide-react';

export type AppTab = 'navigate' | 'multimodal' | 'transit' | 'incidents' | 'emergency';

interface BottomNavProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
  hidden?: boolean;
  isRtl?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ active, onChange, hidden = false, isRtl = false }) => {
  if (hidden) return null; // clear the screen while driving

  const items: { id: AppTab; label: string; icon: React.ReactNode }[] = [
    { id: 'navigate', label: isRtl ? 'راستہ' : 'Route', icon: <Navigation className="w-5 h-5" /> },
    { id: 'multimodal', label: isRtl ? 'موازنہ' : 'Compare', icon: <Scale className="w-5 h-5" /> },
    { id: 'transit', label: isRtl ? 'میٹرو' : 'Transit', icon: <Train className="w-5 h-5" /> },
    { id: 'incidents', label: isRtl ? 'الرٹس' : 'Alerts', icon: <AlertTriangle className="w-5 h-5" /> },
    { id: 'emergency', label: isRtl ? 'ایمرجنسی' : 'SOS', icon: <ShieldAlert className="w-5 h-5" /> }
  ];

  // Active tab = ink pill with the label inside; the rest are quiet icons with small labels.
  return (
    <nav aria-label="Main" className="skin-nav absolute bottom-0 inset-x-0 z-40 h-16 bg-[color:var(--surface)] border-t border-[color:var(--line)]">
      <div className="max-w-md mx-auto h-full px-2 flex items-center justify-around gap-1">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onChange(item.id)}
              className={`flex-1 h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
                isActive ? 'text-[color:var(--ink)] font-extrabold' : 'text-[color:var(--ink-2)] font-semibold hover:text-[color:var(--ink)]'
              }`}
            >
              <span className={`nav-pill px-4 py-1 rounded-full ${isActive ? 'ui-btn-ink !shadow-none' : ''}`}>{item.icon}</span>
              <span className="text-[11px]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

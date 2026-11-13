/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Compass, Train, AlertTriangle, WifiOff, ShieldAlert } from 'lucide-react';

export type NavDestination = 'explore' | 'transit' | 'report' | 'offline' | 'sos';

interface BottomNavProps {
  currentDestination: NavDestination;
  onNavigate: (dest: NavDestination) => void;
  isNavigatingLive?: boolean;
  isRtl?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentDestination,
  onNavigate,
  isNavigatingLive = false,
  isRtl = false
}) => {
  // Hide bottom nav during active driving to keep UI uncluttered
  if (isNavigatingLive) return null;

  const items = [
    { id: 'explore' as NavDestination, label: isRtl ? 'دریافت' : 'Explore', icon: <Compass className="w-5 h-5" /> },
    { id: 'transit' as NavDestination, label: isRtl ? 'میٹرو' : 'Transit', icon: <Train className="w-5 h-5" /> },
    { id: 'report' as NavDestination, label: isRtl ? 'رپورٹ' : 'Report', icon: <AlertTriangle className="w-5 h-5" /> },
    { id: 'offline' as NavDestination, label: isRtl ? 'آف لائن' : 'Offline', icon: <WifiOff className="w-5 h-5" /> },
    { id: 'sos' as NavDestination, label: isRtl ? 'ایمرجنسی' : 'SOS', icon: <ShieldAlert className="w-5 h-5" /> },
  ];

  return (
    <nav className="absolute bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-emerald-900/10 dark:border-slate-800 shadow-[0_-10px_25px_rgba(20,60,53,0.08)] pb-safe rounded-t-[2rem]">
      <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-around">
        {items.map((item) => {
          const isActive = currentDestination === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-2xl transition-all cursor-pointer ${
                isActive
                  ? 'text-[#143C35] dark:text-emerald-400 font-extrabold scale-105 bg-[#20A477]/10 dark:bg-emerald-950/50'
                  : 'text-slate-500 hover:text-[#143C35] dark:hover:text-slate-200 font-medium'
              }`}
            >
              <div className={isActive ? 'text-[#20A477] dark:text-emerald-400' : 'text-slate-400'}>
                {item.icon}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

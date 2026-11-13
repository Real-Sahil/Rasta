/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export type SheetSnap = 'peek' | 'half' | 'full';

// Fractions of the viewport height. The nav bar (NAV_H) always sits below the sheet.
const SNAP_FRACTION: Record<SheetSnap, number> = { peek: 0.3, half: 0.52, full: 0.8 };
const NAV_H = 64;
const MIN_PEEK_PX = 200;

interface BottomSheetProps {
  title: string;
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  /** Hide the sheet entirely (e.g. during turn-by-turn navigation) */
  hidden?: boolean;
  /** Controls that float just above the sheet and move with it */
  floating?: React.ReactNode;
  /** Sticky primary action, always visible above the nav bar */
  footer?: React.ReactNode;
  isRtl?: boolean;
  children: React.ReactNode;
}

const heightFor = (snap: SheetSnap, vh: number) => {
  const px = Math.round(vh * SNAP_FRACTION[snap]);
  return snap === 'peek' ? Math.max(MIN_PEEK_PX, px) : px;
};

export const BottomSheet: React.FC<BottomSheetProps> = ({ title, snap, onSnapChange, hidden = false, floating, footer, isRtl = false, children }) => {
  const [vh, setVh] = useState(() => (typeof window === 'undefined' ? 800 : window.innerHeight));
  const [dragH, setDragH] = useState<number | null>(null);
  const drag = useRef<{ startY: number; startH: number; moved: boolean } | null>(null);

  useEffect(() => {
    const on = () => setVh(window.innerHeight);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  const baseH = heightFor(snap, vh);
  const h = dragH ?? baseH;

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY, startH: baseH, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.startY - e.clientY;
    if (Math.abs(dy) > 4) d.moved = true;
    if (d.moved) setDragH(Math.max(MIN_PEEK_PX, Math.min(heightFor('full', vh), d.startH + dy)));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      // tap: cycle peek -> half -> full -> peek
      onSnapChange(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek');
    } else if (dragH != null) {
      const options: SheetSnap[] = ['peek', 'half', 'full'];
      onSnapChange(options.reduce((best, s) => (Math.abs(heightFor(s, vh) - dragH) < Math.abs(heightFor(best, vh) - dragH) ? s : best), 'peek' as SheetSnap));
    }
    setDragH(null);
  };

  const side = isRtl ? 'left-3' : 'right-3';

  if (hidden) {
    return floating ? <div className={`absolute ${side} bottom-6 z-30 flex flex-col gap-3 items-center`}>{floating}</div> : null;
  }

  return (
    <div
      className="absolute inset-x-0 z-30"
      style={{ bottom: NAV_H, height: h, transition: dragH == null ? 'height 220ms ease' : 'none' }}
    >
      {floating && <div className={`absolute ${side} bottom-full mb-3 flex flex-col gap-3 items-center`}>{floating}</div>}

      <div className="w-full h-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl shadow-[0_-12px_35px_rgba(15,23,42,0.18)] flex flex-col overflow-hidden">
        {/* Drag handle + title */}
        <div
          role="button"
          tabIndex={0}
          aria-label={snap === 'full' ? 'Collapse panel' : 'Expand panel'}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { drag.current = null; setDragH(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSnapChange(snap === 'full' ? 'peek' : 'full'); }}
          className="touch-none select-none cursor-grab active:cursor-grabbing shrink-0 pt-2 pb-2 px-5 border-b border-slate-100 dark:border-slate-800"
        >
          <div className="mx-auto w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mb-2" />
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate">{title}</h3>
            {snap === 'full' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">{children}</div>

        {footer && <div className="shrink-0 p-3 border-t border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95">{footer}</div>}
      </div>
    </div>
  );
};

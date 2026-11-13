/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { RouteOption } from '../types';
import { NavSession } from '../core/navigation';
import { CornerUpLeft, CornerUpRight, ArrowUp, CheckCircle, Volume2, VolumeX, RotateCcw, Gauge, Loader2 } from 'lucide-react';

interface NavHudProps {
  route: RouteOption;
  session: NavSession;
  speedKmh: number | null;
  muted: boolean;
  rerouting: boolean;
  /** Why directions may not be spoken (no voice on this device, approximate Punjabi). Null = nothing to say. */
  voiceNotice?: string | null;
  isRtl: boolean;
  onRepeat: () => void;
  onToggleMute: () => void;
  onExit: () => void;
}

const fmtDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);

export const NavHud: React.FC<NavHudProps> = ({ route, session, speedKmh, muted, rerouting, voiceNotice = null, isRtl, onRepeat, onToggleMute, onExit }) => {
  const step = route.steps[session.upcomingStepIndex] ?? route.steps[route.steps.length - 1];
  const eta = new Date(Date.now() + session.remainingS * 1000);
  const etaClock = eta.toLocaleTimeString(isRtl ? 'ur-PK' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  const Icon = step.maneuver === 'turn-left' ? CornerUpLeft : step.maneuver === 'turn-right' ? CornerUpRight : step.maneuver === 'arrive' ? CheckCircle : ArrowUp;

  return (
    <div className="absolute top-3 left-3 right-3 lg:left-4 lg:w-[440px] z-30">
      <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3.5 shadow-2xl border border-emerald-500/50 space-y-2.5">
        {(session.status === 'off_route' || rerouting) && (
          <div className="flex items-center gap-2 text-[11px] font-bold text-amber-300">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{isRtl ? 'راستہ دوبارہ طے ہو رہا ہے…' : 'Off route, recalculating…'}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black leading-none">{fmtDistance(session.distanceToManeuverM)}</div>
              <p className="text-xs sm:text-sm font-bold text-slate-200 line-clamp-2 mt-1">{isRtl ? step.instructionUrdu : step.instruction}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button type="button" onClick={onRepeat} aria-label="Repeat instruction" className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={onToggleMute} aria-label={muted ? 'Unmute voice' : 'Mute voice'} className={`p-1.5 rounded-lg cursor-pointer ${muted ? 'bg-amber-600' : 'bg-slate-800 hover:bg-slate-700'}`}>
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <button type="button" onClick={onExit} className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold cursor-pointer">
              {isRtl ? 'ختم' : 'Exit'}
            </button>
          </div>
        </div>
        {voiceNotice && !muted && (
          <p role="status" className="text-[11px] font-semibold text-amber-300">{voiceNotice}</p>
        )}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 font-bold text-emerald-400">
            <Gauge className="w-3.5 h-3.5" />
            <span>{speedKmh == null ? '— km/h' : `${speedKmh} km/h`}</span>
          </div>
          <div className="flex items-center gap-3 text-slate-200 font-semibold">
            <span>{fmtDistance(session.remainingM)}</span>
            <span>{Math.max(1, Math.round(session.remainingS / 60))} min</span>
            <span className="text-white">ETA {etaClock}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

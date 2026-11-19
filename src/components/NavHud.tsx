/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { RouteOption } from '../types';
import { NavSession } from '../core/navigation';
import { useMobilityTheme } from './ThemeLayoutWrapper';
import { isChamakSkin, CHAMAK_STRIP, ensureChamakFont } from './chamakSkin';
import { CornerUpLeft, CornerUpRight, ArrowUp, CheckCircle, Volume2, VolumeX, RotateCcw, Gauge, Loader2, Share2 } from 'lucide-react';

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
  onShare?: () => void;
}

const fmtDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);

export const NavHud: React.FC<NavHudProps> = ({ route, session, speedKmh, muted, rerouting, voiceNotice = null, isRtl, onRepeat, onToggleMute, onExit, onShare }) => {
  const step = route.steps[session.upcomingStepIndex] ?? route.steps[route.steps.length - 1];
  const eta = new Date(Date.now() + session.remainingS * 1000);
  const etaClock = eta.toLocaleTimeString(isRtl ? 'ur-PK' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  const chamak = React.useMemo(() => isChamakSkin(), []);
  React.useEffect(() => { if (chamak && !isRtl) ensureChamakFont(); }, [chamak, isRtl]);
  const yatra = chamak && !isRtl ? { fontFamily: "'Yatra One', 'Plus Jakarta Sans', serif" } : undefined;
  const { theme } = useMobilityTheme();
  const light = chamak && theme === 'light';
  // Quieter at speed: past 30 km/h the decoration shrinks so only the turn and distance stand out.
  const calm = chamak && speedKmh != null && speedKmh >= 30;
  const k = {
    card: light ? 'bg-[#FFFBF0]/95 text-[#1B1B1D] border-[#C99400]' : 'bg-[#14161A]/95 text-white border-[#F5B700]',
    rule: light ? 'border-[#E6DDC4]' : 'border-slate-800',
    dist: light ? 'text-[#8A5A00]' : 'text-[#F5B700]',
    text: light ? 'text-slate-800' : 'text-slate-200',
    btn: light ? 'bg-[#EFE6CC] hover:bg-[#E6DAB4] text-[#1B1B1D]' : 'bg-slate-800 hover:bg-slate-700',
    warn: light ? 'text-amber-800' : 'text-amber-300',
    speed: light ? 'text-emerald-700' : 'text-emerald-400',
    eta: light ? 'text-[#1B1B1D]' : 'text-white',
  };
  const Icon = step.maneuver === 'turn-left' ? CornerUpLeft : step.maneuver === 'turn-right' ? CornerUpRight : step.maneuver === 'arrive' ? CheckCircle : ArrowUp;

  return (
    <div className="absolute top-3 left-3 right-3 lg:left-4 lg:w-[440px] z-30">
      <div className={chamak
        ? `${k.card} backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl border-2 transition-colors`
        : 'bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3.5 shadow-2xl border border-emerald-500/50 space-y-2.5'}>
        {chamak && <div aria-hidden="true" className={`border-b-2 border-[#F5B700] transition-all ${calm ? 'h-1 opacity-50' : 'h-2.5'}`} style={{ backgroundImage: CHAMAK_STRIP, backgroundSize: '20px 10px' }} />}
        <div className={chamak ? 'p-3.5 space-y-2.5' : 'space-y-2.5'}>
        {(session.status === 'off_route' || rerouting) && (
          <div className={`flex items-center gap-2 text-[11px] font-bold ${chamak ? k.warn : 'text-amber-300'}`}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{isRtl ? 'راستہ دوبارہ طے ہو رہا ہے…' : 'Off route, recalculating…'}</span>
          </div>
        )}
        <div className={`flex items-center justify-between gap-2 border-b pb-2.5 ${chamak ? k.rule : 'border-slate-800'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={chamak
              ? 'relative w-14 h-14 rounded-2xl bg-[#D7263D] text-white ring-2 ring-[#F5B700] flex items-center justify-center shrink-0'
              : 'w-11 h-11 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0'}>
              <Icon className={chamak ? 'w-8 h-8 stroke-[2.5]' : 'w-6 h-6 stroke-[2.5]'} />
              {chamak && !calm && (
                <svg aria-hidden="true" viewBox="-20 -20 40 40" className="absolute -top-2 -right-2 w-5 h-5 drop-shadow">
                  <g fill="#D7263D" stroke="#14161A" strokeWidth="1.6">{[0, 72, 144, 216, 288].map(a => <ellipse key={a} rx="7" ry="11" cy="-10" transform={`rotate(${a})`} />)}</g>
                  <circle r="6" fill="#F5B700" stroke="#14161A" strokeWidth="1.6" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <div className={chamak ? `text-2xl leading-none ${k.dist}` : 'text-lg font-black leading-none'} style={yatra}>{fmtDistance(session.distanceToManeuverM)}</div>
              <p className={`text-xs sm:text-sm font-bold line-clamp-2 mt-1 ${chamak ? k.text : 'text-slate-200'}`}>{isRtl ? step.instructionUrdu : step.instruction}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onShare && (
              <button type="button" onClick={onShare} aria-label="Share trip" className={`p-1.5 rounded-lg cursor-pointer ${chamak ? k.btn : 'bg-slate-800 hover:bg-slate-700'}`}>
                <Share2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button type="button" onClick={onRepeat} aria-label="Repeat instruction" className={`p-1.5 rounded-lg cursor-pointer ${chamak ? k.btn : 'bg-slate-800 hover:bg-slate-700'}`}>
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={onToggleMute} aria-label={muted ? 'Unmute voice' : 'Mute voice'} className={`p-1.5 rounded-lg cursor-pointer ${muted ? 'bg-amber-600 text-white' : chamak ? k.btn : 'bg-slate-800 hover:bg-slate-700'}`}>
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <button type="button" onClick={onExit} className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold cursor-pointer">
              {isRtl ? 'ختم' : 'Exit'}
            </button>
          </div>
        </div>
        {voiceNotice && !muted && (
          <p role="status" className={`text-[11px] font-semibold ${chamak ? k.warn : 'text-amber-300'}`}>{voiceNotice}</p>
        )}
        <div className="flex items-center justify-between text-xs">
          <div className={`flex items-center gap-1 font-bold ${chamak ? k.speed : 'text-emerald-400'}`}>
            <Gauge className="w-3.5 h-3.5" />
            <span>{speedKmh == null ? '— km/h' : `${speedKmh} km/h`}</span>
          </div>
          <div className={`flex items-center gap-3 font-semibold ${chamak ? k.text : 'text-slate-200'}`}>
            <span>{fmtDistance(session.remainingM)}</span>
            <span>{Math.max(1, Math.round(session.remainingS / 60))} min</span>
            <span className={chamak ? k.eta : 'text-white'}>ETA {etaClock}</span>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

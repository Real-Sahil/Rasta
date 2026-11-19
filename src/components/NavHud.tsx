/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { RouteOption } from '../types';
import { NavSession } from '../core/navigation';
import { useMobilityTheme } from './ThemeLayoutWrapper';
import { useSkin, CHAMAK_STRIP } from './chamakSkin';
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

interface HudPal { card: string; rule: string; dist: string; text: string; btn: string; eta: string; badge: string; radius: string }
const HUD: Record<string, Record<'light' | 'dark', HudPal>> = {
  chamak: {
    light: { card: 'bg-[#FFFBF0]/95 text-[#1B1B1D] border-[#C99400]', rule: 'border-[#E6DDC4]', dist: 'text-[#8A5A00]', text: 'text-slate-800', btn: 'bg-[#EFE6CC] hover:bg-[#E6DAB4] text-[#1B1B1D]', eta: 'text-[#1B1B1D]', badge: 'bg-[#D7263D] text-white ring-2 ring-[#F5B700]', radius: 'rounded-2xl' },
    dark: { card: 'bg-[#14161A]/95 text-white border-[#F5B700]', rule: 'border-slate-800', dist: 'text-[#F5B700]', text: 'text-slate-200', btn: 'bg-slate-800 hover:bg-slate-700', eta: 'text-white', badge: 'bg-[#D7263D] text-white ring-2 ring-[#F5B700]', radius: 'rounded-2xl' },
  },
  luce: {
    light: { card: 'bg-[#FAF8F3]/95 text-[#1A1814] border-[#8A6A2F]', rule: 'border-[#D9CFB8]', dist: 'text-[#8A6A2F]', text: 'text-[#3A352B]', btn: 'bg-[#EFE9DA] hover:bg-[#E5DCC6] text-[#1A1814]', eta: 'text-[#1A1814]', badge: 'bg-transparent text-[#8A6A2F] ring-2 ring-[#8A6A2F] rounded-full', radius: 'rounded-xl' },
    dark: { card: 'bg-[#0B0B0C]/95 text-[#EDE6D6] border-[#C9A24B]', rule: 'border-[#3A3224]', dist: 'text-[#C9A24B]', text: 'text-[#CFC7B4]', btn: 'bg-[#1A1814] hover:bg-[#26221A]', eta: 'text-[#EDE6D6]', badge: 'bg-transparent text-[#C9A24B] ring-2 ring-[#C9A24B] rounded-full', radius: 'rounded-xl' },
  },
  miniature: {
    light: { card: 'bg-[#FBF3DF]/95 text-[#1F2F5C] border-[#1F3A6E]', rule: 'border-[#D9C99B]', dist: 'text-[#1F3A6E]', text: 'text-[#2B3A66]', btn: 'bg-[#F0E4C2] hover:bg-[#E8D9AE] text-[#1F2F5C]', eta: 'text-[#1F2F5C]', badge: 'bg-[#C4381F] text-[#FBF3DF] ring-2 ring-[#B8892B]', radius: 'rounded-lg' },
    dark: { card: 'bg-[#101A33]/95 text-[#F3E7C6] border-[#E3B341]', rule: 'border-[#26375F]', dist: 'text-[#E3B341]', text: 'text-[#E7DBB8]', btn: 'bg-[#1B2A50] hover:bg-[#24366A]', eta: 'text-[#F3E7C6]', badge: 'bg-[#C4381F] text-[#FBF3DF] ring-2 ring-[#E3B341]', radius: 'rounded-lg' },
  },
  schematic: {
    light: { card: 'bg-white/95 text-[#0B1020] border-[#0019A8]', rule: 'border-[#C9CEE8]', dist: 'text-[#0019A8]', text: 'text-slate-800', btn: 'bg-[#E8EBFA] hover:bg-[#D9DEF6] text-[#0B1020]', eta: 'text-[#0B1020]', badge: 'bg-[#0019A8] text-white', radius: 'rounded-none' },
    dark: { card: 'bg-[#0B1020]/95 text-[#F2F4FF] border-[#7C8CFF]', rule: 'border-[#27306B]', dist: 'text-[#9AA7FF]', text: 'text-slate-200', btn: 'bg-[#18204A] hover:bg-[#222C66]', eta: 'text-[#F2F4FF]', badge: 'bg-[#4457FF] text-white', radius: 'rounded-none' },
  },
  nastaliq: {
    light: { card: 'bg-[#FBF6E9]/95 text-[#16241E] border-[#0F6B4F]', rule: 'border-[#DDD2AE]', dist: 'text-[#0F6B4F]', text: 'text-[#16241E]', btn: 'bg-[#EFE7CC] hover:bg-[#E6DBB6] text-[#16241E]', eta: 'text-[#16241E]', badge: 'bg-[#0F6B4F] text-white', radius: 'rounded-2xl' },
    dark: { card: 'bg-[#0E1613]/95 text-[#EDE9D8] border-[#4FC79C]', rule: 'border-[#2E4A3D]', dist: 'text-[#4FC79C]', text: 'text-[#E3DFC9]', btn: 'bg-[#16241E] hover:bg-[#1E3329]', eta: 'text-[#EDE9D8]', badge: 'bg-[#0F6B4F] text-white', radius: 'rounded-2xl' },
  },
};

const fmtDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);

export const NavHud: React.FC<NavHudProps> = ({ route, session, speedKmh, muted, rerouting, voiceNotice = null, isRtl, onRepeat, onToggleMute, onExit, onShare }) => {
  const step = route.steps[session.upcomingStepIndex] ?? route.steps[route.steps.length - 1];
  const eta = new Date(Date.now() + session.remainingS * 1000);
  const etaClock = eta.toLocaleTimeString(isRtl ? 'ur-PK' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  const skin = useSkin();
  const skinned = skin !== 'default'; // any theme restyles the card; only Chamak adds the strip and flower
  const chamak = skinned;
  const isCk = skin === 'chamak';
  const fontFor: Record<string, string> = { chamak: "'Yatra One', 'Plus Jakarta Sans', serif", miniature: "'Cormorant Garamond', Georgia, serif", nastaliq: "'Noto Nastaliq Urdu', 'Plus Jakarta Sans', serif" };
  const yatra = skinned && fontFor[skin] && (skin === 'nastaliq' || !isRtl) ? { fontFamily: fontFor[skin] } : undefined;
  const { theme } = useMobilityTheme();
  const light = skinned && theme === 'light';
  // Quieter at speed: past 30 km/h the decoration shrinks so only the turn and distance stand out.
  const calm = skinned && speedKmh != null && speedKmh >= 30;
  const k = { ...(HUD[skin] ?? HUD.chamak)[light ? 'light' : 'dark'], warn: light ? 'text-amber-800' : 'text-amber-300', speed: light ? 'text-emerald-700' : 'text-emerald-400' };
  const Icon = step.maneuver === 'turn-left' ? CornerUpLeft : step.maneuver === 'turn-right' ? CornerUpRight : step.maneuver === 'arrive' ? CheckCircle : ArrowUp;

  return (
    <div className="absolute top-3 left-3 right-3 lg:left-4 lg:w-[440px] z-30">
      <div className={chamak
        ? `${k.card} backdrop-blur-md ${k.radius} overflow-hidden shadow-2xl border-2 transition-colors`
        : 'bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3.5 shadow-2xl border border-emerald-500/50 space-y-2.5'}>
        {isCk && <div aria-hidden="true" className={`border-b-2 border-[#F5B700] transition-all ${calm ? 'h-1 opacity-50' : 'h-2.5'}`} style={{ backgroundImage: CHAMAK_STRIP, backgroundSize: '20px 10px' }} />}
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
              ? `relative w-14 h-14 ${skin === 'luce' ? '' : k.radius} ${k.badge} flex items-center justify-center shrink-0`
              : 'w-11 h-11 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0'}>
              <Icon className={chamak ? 'w-8 h-8 stroke-[2.5]' : 'w-6 h-6 stroke-[2.5]'} />
              {isCk && !calm && (
                <svg aria-hidden="true" viewBox="-20 -20 40 40" className="absolute -top-2 -right-2 w-5 h-5 drop-shadow">
                  <g fill="#D7263D" stroke="#14161A" strokeWidth="1.6">{[0, 72, 144, 216, 288].map(a => <ellipse key={a} rx="7" ry="11" cy="-10" transform={`rotate(${a})`} />)}</g>
                  <circle r="6" fill="#F5B700" stroke="#14161A" strokeWidth="1.6" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <div className={chamak ? `text-2xl leading-none ${k.dist}` : 'text-lg font-black leading-none'} style={yatra}>{fmtDistance(session.distanceToManeuverM)}</div>
              <p className={`${skin === 'nastaliq' && isRtl ? 'text-base leading-loose' : 'text-xs sm:text-sm'} font-bold line-clamp-2 mt-1 ${chamak ? k.text : 'text-slate-200'}`} style={skin === 'nastaliq' && isRtl ? yatra : undefined}>{isRtl ? step.instructionUrdu : step.instruction}</p>
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

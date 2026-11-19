/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { RouteOption } from '../types';
import { NavSession } from '../core/navigation';
import { PHRASES, phraseForManeuver } from '../core/phrases';
import { CornerUpLeft, CornerUpRight, ArrowUp, CheckCircle, Volume2, VolumeX, RotateCcw, Share2, Loader2, Gauge } from 'lucide-react';

export interface SkinHudProps {
  route: RouteOption;
  session: NavSession;
  speedKmh: number | null;
  muted: boolean;
  rerouting: boolean;
  voiceNotice: string | null;
  isRtl: boolean;
  language: 'en' | 'ur' | 'pa' | 'ar';
  light: boolean;
  onRepeat: () => void;
  onToggleMute: () => void;
  onExit: () => void;
  onShare?: () => void;
}

const fmtDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);
const iconFor = (m: string) => (m === 'turn-left' ? CornerUpLeft : m === 'turn-right' ? CornerUpRight : m === 'arrive' ? CheckCircle : ArrowUp);

/** Shared row of small controls, tinted by the skin. */
const Controls: React.FC<SkinHudProps & { btn: string }> = ({ btn, muted, isRtl, onShare, onRepeat, onToggleMute, onExit }) => (
  <div className="flex items-center gap-1.5 shrink-0">
    {onShare && <button type="button" onClick={onShare} aria-label="Share trip" className={`p-1.5 rounded-lg cursor-pointer ${btn}`}><Share2 className="w-3.5 h-3.5" /></button>}
    <button type="button" onClick={onRepeat} aria-label="Repeat instruction" className={`p-1.5 rounded-lg cursor-pointer ${btn}`}><RotateCcw className="w-3.5 h-3.5" /></button>
    <button type="button" onClick={onToggleMute} aria-label={muted ? 'Unmute voice' : 'Mute voice'} className={`p-1.5 rounded-lg cursor-pointer ${muted ? 'bg-amber-600 text-white' : btn}`}>
      {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
    </button>
    <button type="button" onClick={onExit} className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer">{isRtl ? 'ختم' : 'Exit'}</button>
  </div>
);

const Footer: React.FC<{ p: SkinHudProps; text: string; sub: string; speed: string }> = ({ p, text, sub, speed }) => {
  const etaClock = new Date(Date.now() + p.session.remainingS * 1000).toLocaleTimeString(p.isRtl ? 'ur-PK' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  return (
    <>
      {p.voiceNotice && !p.muted && <p role="status" className={`text-[11px] font-semibold ${p.light ? 'text-amber-800' : 'text-amber-300'}`}>{p.voiceNotice}</p>}
      <div className="flex items-center justify-between gap-2 text-xs whitespace-nowrap">
        <div className={`flex items-center gap-1 font-bold ${speed}`}><Gauge className="w-3.5 h-3.5" /><span>{p.speedKmh == null ? '— km/h' : `${p.speedKmh} km/h`}</span></div>
        <div dir="ltr" className={`flex items-center gap-3 font-semibold ${sub}`}>
          <span>{fmtDistance(p.session.remainingM)}</span>
          <span>{Math.max(1, Math.round(p.session.remainingS / 60))} min</span>
          <span className={text}>ETA {etaClock}</span>
        </div>
      </div>
    </>
  );
};

const Reroute: React.FC<{ p: SkinHudProps; cls: string }> = ({ p, cls }) =>
  p.session.status === 'off_route' || p.rerouting ? (
    <div className={`flex items-center gap-2 text-[11px] font-bold ${cls}`}>
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      <span>{p.isRtl ? 'راستہ دوبارہ طے ہو رہا ہے…' : 'Off route, recalculating…'}</span>
    </div>
  ) : null;

/** Fraction of the final 500 m already covered (0 far away, 1 at the turn). Pure, so it is unit-tested. */
export const dialProgress = (distanceToManeuverM: number, bandM = 500) => 1 - Math.max(0, Math.min(1, distanceToManeuverM / bandM));

const TICKS = 60;

/** Luce: a watch-style dial. Ticks light up clockwise as the turn gets close; no cards, no ornament. */
export const LuceHud: React.FC<SkinHudProps> = (p) => {
  const { route, session, light } = p;
  const step = route.steps[session.upcomingStepIndex] ?? route.steps[route.steps.length - 1];
  const Icon = iconFor(step.maneuver);
  const lit = light ? '#8A6A2F' : '#C9A24B';
  const dim = light ? '#D9CFB8' : '#3A3224';
  const prog = dialProgress(session.distanceToManeuverM);
  const litCount = Math.round(prog * TICKS);
  const ink = light ? 'text-[#1A1814]' : 'text-[#EDE6D6]';
  const sub = light ? 'text-[#3A352B]' : 'text-[#CFC7B4]';
  return (
    <div className="absolute top-3 left-3 right-3 lg:left-4 lg:w-[440px] z-30">
      <div className={`${light ? 'bg-[#FAF8F3]/95' : 'bg-[#0B0B0C]/95'} ${ink} backdrop-blur-md rounded-3xl shadow-2xl border`} style={{ borderColor: lit }}>
        <div className="p-3.5 space-y-2.5">
          <Reroute p={p} cls={light ? 'text-amber-800' : 'text-amber-300'} />
          <div className="flex items-center gap-4">
            <div className="relative w-28 h-28 shrink-0" role="img" aria-label={`${fmtDistance(session.distanceToManeuverM)}`} data-testid="luce-dial">
              <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full" aria-hidden="true">
                {Array.from({ length: TICKS }, (_, i) => {
                  const major = i % 5 === 0;
                  const a = (i / TICKS) * 2 * Math.PI - Math.PI / 2;
                  const r1 = 57, r2 = major ? 49 : 52;
                  return <line key={i} x1={60 + r1 * Math.cos(a)} y1={60 + r1 * Math.sin(a)} x2={60 + r2 * Math.cos(a)} y2={60 + r2 * Math.sin(a)} stroke={i < litCount ? lit : dim} strokeWidth={major ? 2 : 1.2} strokeLinecap="round" />;
                })}
                <circle cx="60" cy="60" r="42" fill="none" stroke={dim} strokeWidth="1" />
                <circle cx="60" cy="60" r="42" fill="none" stroke={lit} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${prog * 2 * Math.PI * 42} 999`} transform="rotate(-90 60 60)" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center" style={{ color: lit }}><Icon className="w-9 h-9 stroke-[1.5]" /></div>
            </div>
            <div className="min-w-0 flex-1">
              <div dir="ltr" className="text-4xl font-extralight tracking-tight leading-none tabular-nums">{fmtDistance(session.distanceToManeuverM)}</div>
              <p className={`mt-2 text-xs sm:text-sm font-medium tracking-wide line-clamp-2 ${sub}`}>{p.isRtl ? step.instructionUrdu : step.instruction}</p>
            </div>
          </div>
          <div className={`border-t pt-2.5 space-y-2.5`} style={{ borderColor: dim }}>
            <Footer p={p} text={ink} sub={sub} speed={light ? 'text-[#8A6A2F]' : 'text-[#C9A24B]'} />
            <div className="flex justify-end"><Controls {...p} btn={light ? 'bg-[#EFE9DA] hover:bg-[#E5DCC6] text-[#1A1814]' : 'bg-[#1A1814] hover:bg-[#26221A] text-[#EDE6D6]'} /></div>
          </div>
        </div>
      </div>
    </div>
  );
};

/** The word shown at poster size. Urdu/Punjabi users get their own language; everyone else English. Wording is a draft pending native review. */
export function posterWord(maneuver: string, language: 'en' | 'ur' | 'pa' | 'ar'): string {
  const lang = language === 'ur' || language === 'pa' ? language : 'en';
  return PHRASES[phraseForManeuver(maneuver)][lang];
}

/** Nastaliq: the turn word is the interface. */
export const NastaliqHud: React.FC<SkinHudProps> = (p) => {
  const { route, session, light, language } = p;
  const step = route.steps[session.upcomingStepIndex] ?? route.steps[route.steps.length - 1];
  const arrived = session.status === 'arrived';
  const word = posterWord(arrived ? 'arrive' : step.maneuver, language);
  const rtlWord = language === 'ur' || language === 'pa';
  const accent = light ? 'text-[#0F6B4F]' : 'text-[#4FC79C]';
  const ink = light ? 'text-[#16241E]' : 'text-[#EDE9D8]';
  const rule = light ? 'border-[#DDD2AE]' : 'border-[#2E4A3D]';
  const font = { fontFamily: "'Noto Nastaliq Urdu', 'Plus Jakarta Sans', serif" };
  return (
    <div className="absolute top-3 left-3 right-3 lg:left-4 lg:w-[440px] z-30">
      <div className={`${light ? 'bg-[#FBF6E9]/95' : 'bg-[#0E1613]/95'} ${ink} backdrop-blur-md rounded-2xl shadow-2xl border-2 ${light ? 'border-[#0F6B4F]' : 'border-[#4FC79C]'}`}>
        <div className="p-3.5 space-y-2">
          <Reroute p={p} cls={light ? 'text-amber-800' : 'text-amber-300'} />
          <div dir={rtlWord ? 'rtl' : 'ltr'} data-testid="poster-word" className={`${accent} font-bold leading-[1.9] ${rtlWord ? 'text-5xl' : 'text-4xl leading-tight'} break-words`} style={rtlWord ? font : undefined}>{word}</div>
          <div className={`flex items-end justify-between gap-3 border-t pt-2 ${rule}`}>
            <div dir="ltr" className="text-3xl font-black tabular-nums leading-none">{fmtDistance(session.distanceToManeuverM)}</div>
            <p className={`text-xs sm:text-sm font-semibold line-clamp-2 text-end ${ink}`}>{p.isRtl ? step.instructionUrdu : step.instruction}</p>
          </div>
          <Footer p={p} text={ink} sub={ink} speed={light ? 'text-emerald-700' : 'text-emerald-400'} />
          <div className="flex justify-end"><Controls {...p} btn={light ? 'bg-[#EFE7CC] hover:bg-[#E6DBB6] text-[#16241E]' : 'bg-[#16241E] hover:bg-[#1E3329] text-[#EDE9D8]'} /></div>
        </div>
      </div>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { RouteOption } from '../types';
import { NavSession } from '../core/navigation';
import { thenPhrase, thenText, tripProgress } from '../core/hud';
import { VoiceLang } from '../core/phrases';
import { useMobilityTheme } from './ThemeLayoutWrapper';
import { useSkin, CHAMAK_STRIP } from './chamakSkin';
import { LuceHud, NastaliqHud } from './SkinHuds';
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
  const { theme, language, t } = useMobilityTheme();
  const then = thenPhrase(session, route);
  const voiceLang: VoiceLang = language === 'ur' || language === 'pa' ? language : 'en';
  const progress = tripProgress(session);
  const light = skinned && theme === 'light';
  // Quieter at speed: past 30 km/h the decoration shrinks so only the turn and distance stand out.
  const calm = skinned && speedKmh != null && speedKmh >= 30;
  const k = { ...(HUD[skin] ?? HUD.chamak)[light ? 'light' : 'dark'], warn: light ? 'text-amber-800' : 'text-amber-300', speed: light ? 'text-emerald-700' : 'text-emerald-400' };
  if (skin === 'luce' || skin === 'nastaliq') {
    const H = skin === 'luce' ? LuceHud : NastaliqHud;
    return <H route={route} session={session} speedKmh={speedKmh} muted={muted} rerouting={rerouting} voiceNotice={voiceNotice} isRtl={isRtl} language={language} light={light} onRepeat={onRepeat} onToggleMute={onToggleMute} onExit={onExit} onShare={onShare} />;
  }
  const Icon = step.maneuver === 'turn-left' ? CornerUpLeft : step.maneuver === 'turn-right' ? CornerUpRight : step.maneuver === 'arrive' ? CheckCircle : ArrowUp;

  return (
    <div className="anim-drop absolute top-3 left-3 right-3 lg:left-4 lg:w-[440px] z-30">
      <div className={chamak
        ? `${k.card} backdrop-blur-md ${k.radius} overflow-hidden shadow-2xl border-2 transition-colors`
        : 'bg-[#0E1A14]/[0.97] backdrop-blur-xl text-white rounded-[26px] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_40px_-14px_rgba(0,0,0,0.65)] ring-1 ring-white/10 space-y-3'}>
        {isCk && <div aria-hidden="true" className={`border-b-2 border-[#F5B700] transition-all ${calm ? 'h-1 opacity-50' : 'h-2.5'}`} style={{ backgroundImage: CHAMAK_STRIP, backgroundSize: '20px 10px' }} />}
        <div className={chamak ? 'p-3.5 space-y-2.5' : 'space-y-2.5'}>
        {(session.status === 'off_route' || rerouting) && (
          <div className={`flex items-center gap-2 text-[11px] font-bold ${chamak ? k.warn : 'text-[color:var(--signal)]'}`}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{isRtl ? 'راستہ دوبارہ طے ہو رہا ہے…' : 'Off route, recalculating…'}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {/* Keyed by step: a new manoeuvre slides in from the reading side; the distance ticks without moving. */}
          <div key={session.upcomingStepIndex} className={`${isRtl ? 'anim-step-rtl' : 'anim-step'} flex items-center gap-2.5 min-w-0`}>
            <div className={chamak
              ? `relative w-14 h-14 ${k.radius} ${k.badge} flex items-center justify-center shrink-0`
              : 'ui-signal w-14 h-14 rounded-[18px] flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-2px_0_rgba(0,0,0,0.15)]'}>
              <Icon className={chamak ? 'w-8 h-8 stroke-[2.5]' : 'w-8 h-8 stroke-[2.75]'} />
              {isCk && !calm && (
                <svg aria-hidden="true" viewBox="-20 -20 40 40" className="absolute -top-2 -right-2 w-5 h-5 drop-shadow">
                  <g fill="#D7263D" stroke="#14161A" strokeWidth="1.6">{[0, 72, 144, 216, 288].map(a => <ellipse key={a} rx="7" ry="11" cy="-10" transform={`rotate(${a})`} />)}</g>
                  <circle r="6" fill="#F5B700" stroke="#14161A" strokeWidth="1.6" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <div className={chamak ? `text-2xl leading-none ${k.dist}` : 'font-display num text-[34px] font-extrabold leading-none'} style={yatra}>{fmtDistance(session.distanceToManeuverM)}</div>
              <p className={`text-sm sm:text-[15px] font-bold line-clamp-2 mt-1.5 ${chamak ? k.text : 'text-white/85'}`}>{isRtl ? step.instructionUrdu : step.instruction}</p>
              {then && (
                <p data-testid="hud-then" className={`text-xs font-bold mt-1 ${chamak ? k.text : 'text-white/60'}`}>{thenText(then, voiceLang, voiceLang === 'en' ? 'Then' : t.hudThen)}</p>
              )}
            </div>
          </div>
        </div>
        {/* Trip progress: fills as the remaining distance shrinks. A width transition, nothing that loops. */}
        <div role="progressbar" aria-label={isRtl ? 'سفر کی پیش رفت' : 'Trip progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}
          className={`h-1 rounded-full overflow-hidden ${chamak ? 'bg-current/15' : 'bg-white/10'}`}>
          <div className={`h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none ${chamak ? 'bg-current opacity-70' : 'bg-[color:var(--brand-hi)]'}`}
            style={{ width: `${progress * 100}%` }} />
        </div>
        {voiceNotice && !muted && (
          <p role="status" className={`text-[11px] font-semibold ${chamak ? k.warn : 'text-amber-300'}`}>{voiceNotice}</p>
        )}
        {/* Trip line + controls. Buttons are 36 px circles so they can be hit at a glance (were 26 px). */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="min-w-0 num whitespace-nowrap">
            <div className={`flex items-baseline gap-2 font-semibold ${chamak ? k.text : 'text-white/70'}`}>
              <span className={`text-base font-extrabold ${chamak ? k.eta : 'text-white'}`}>{Math.max(1, Math.round(session.remainingS / 60))} min</span>
              <span>{fmtDistance(session.remainingM)}</span>
              <span>ETA {etaClock}</span>
            </div>
            <div className={`flex items-center gap-1 font-bold mt-0.5 ${chamak ? k.speed : 'text-[color:var(--brand-hi)]'}`}>
              <Gauge className="w-3.5 h-3.5" />
              <span>{speedKmh == null ? '— km/h' : `${speedKmh} km/h`}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onShare && (
              <button type="button" onClick={onShare} aria-label="Share trip" className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform ${chamak ? k.btn : 'bg-white/10 hover:bg-white/20'}`}>
                <Share2 className="w-4 h-4" />
              </button>
            )}
            <button type="button" onClick={onRepeat} aria-label="Repeat instruction" className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform ${chamak ? k.btn : 'bg-white/10 hover:bg-white/20'}`}>
              <RotateCcw className="w-4 h-4" />
            </button>
            <button type="button" onClick={onToggleMute} aria-label={muted ? 'Unmute voice' : 'Mute voice'} className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform ${muted ? 'bg-amber-500 text-[#1A1400]' : chamak ? k.btn : 'bg-white/10 hover:bg-white/20'}`}>
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button type="button" onClick={onExit} className="ui-btn ui-btn-danger h-9 px-3.5 text-xs">
              {isRtl ? 'ختم' : 'Exit'}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

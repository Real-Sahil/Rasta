/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { useMobilityTheme } from './ThemeLayoutWrapper';

type Tab = 'notice' | 'privacy' | 'terms';
const SEEN_KEY = 'buraq_legal_seen_v1';

export const hasSeenNotice = () => {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
};
const markSeen = () => {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode: will show again next visit */ }
};

export const LegalModal: React.FC<{ open: boolean; firstRun: boolean; onClose: () => void }> = ({ open, firstRun, onClose }) => {
  const { t, isRtl } = useMobilityTheme();
  const [tab, setTab] = React.useState<Tab>('notice');
  React.useEffect(() => { if (open) setTab('notice'); }, [open]);
  if (!open) return null;

  const paras: Record<Tab, string[]> = {
    notice: [t.legalNotice1, t.legalNotice2, t.legalNotice3],
    privacy: [t.legalPrivacy1, t.legalPrivacy2, t.legalPrivacy3, t.legalPrivacy4, t.legalPrivacy5],
    terms: [t.legalTerms1, t.legalTerms2, t.legalTerms3, t.legalTerms4]
  };
  const tabs: [Tab, string][] = [['notice', t.legalTabNotice], ['privacy', t.legalTabPrivacy], ['terms', t.legalTabTerms]];
  const close = () => { markSeen(); onClose(); };

  return (
    <div className="anim-fade fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-3" role="dialog" aria-modal="true" aria-label={t.legalTitle} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="anim-sheet w-full max-w-lg max-h-[90vh] flex flex-col rounded-[28px] bg-[color:var(--surface)] text-[color:var(--ink)] shadow-[var(--shadow-float)]">
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-2">
          <span className="ui-signal w-9 h-9 rounded-xl flex items-center justify-center shrink-0"><ShieldCheck className="w-5 h-5" /></span>
          <h2 className="font-display font-extrabold text-[19px] flex-1">{t.legalTitle}</h2>
          {!firstRun && (
            <button type="button" onClick={close} aria-label={t.legalClose} className="ui-btn ui-btn-soft w-9 h-9 p-0"><X className="w-4 h-4" /></button>
          )}
        </div>
        <div className="ui-seg mx-5 mt-2" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={tab === id ? 'is-on' : ''}>{label}</button>
          ))}
        </div>
        <div className="px-5 py-4 overflow-y-auto space-y-3 text-sm leading-relaxed text-[color:var(--ink-2)]" role="tabpanel">
          {paras[tab].map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <div className="px-5 pb-5 pt-2">
          <button type="button" onClick={close} className="ui-btn ui-btn-primary w-full h-12 text-[15px]">{firstRun ? t.legalAccept : t.legalClose}</button>
        </div>
      </div>
    </div>
  );
};

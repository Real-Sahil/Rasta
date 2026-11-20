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
    <div className="anim-fade fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-label={t.legalTitle} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="anim-sheet w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl">
        <div className="flex items-center gap-2 p-4 border-b border-slate-200 dark:border-slate-800">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <h2 className="font-bold text-base flex-1">{t.legalTitle}</h2>
          {!firstRun && (
            <button type="button" onClick={close} aria-label={t.legalClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
          )}
        </div>
        <div className="flex gap-1 px-4 pt-3" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tab === id ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{label}</button>
          ))}
        </div>
        <div className="p-4 overflow-y-auto space-y-3 text-sm leading-relaxed" role="tabpanel">
          {paras[tab].map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <button type="button" onClick={close} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm">{firstRun ? t.legalAccept : t.legalClose}</button>
        </div>
      </div>
    </div>
  );
};

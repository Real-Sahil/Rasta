import React, { useEffect, useRef, useState } from 'react';
import { Palette, Check } from 'lucide-react';
import { SKINS, Skin, setSkin, useSkin } from './chamakSkin';

const NAMES: Record<Skin, string> = { default: '', luce: 'Luce', miniature: 'Miniature', schematic: 'Schematic', chamak: 'Chamak', nastaliq: 'Nastaliq' };
const SWATCH: Record<Skin, string> = { default: '#059669', luce: '#C9A24B', miniature: '#1F3A6E', schematic: '#0019A8', chamak: '#D7263D', nastaliq: '#0F6B4F' };

/** Theme options live behind one header button; the choice is remembered on the device. */
export const SkinPicker: React.FC<{ label: string; defaultLabel: string; isRtl?: boolean }> = ({ label, defaultLabel, isRtl }) => {
  const skin = useSkin();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`p-1.5 sm:p-2 rounded-xl border transition-colors cursor-pointer ${skin !== 'default' ? 'text-white border-transparent' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'}`}
        style={skin !== 'default' ? { background: SWATCH[skin] } : undefined}
      >
        <Palette className="w-4 h-4" />
      </button>
      {open && (
        <ul role="listbox" aria-label={label} className={`absolute top-full mt-2 ${isRtl ? 'left-0' : 'right-0'} z-[60] w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1`}>
          {SKINS.map((s) => (
            <li key={s} role="option" aria-selected={skin === s}>
              <button
                type="button"
                onClick={() => { setSkin(s); setOpen(false); }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ background: SWATCH[s] }} />
                <span className="flex-1 text-start">{s === 'default' ? defaultLabel : NAMES[s]}</span>
                {skin === s && <Check className="w-4 h-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

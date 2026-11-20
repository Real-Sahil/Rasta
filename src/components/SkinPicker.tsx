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
        className={`ui-btn w-9 h-9 p-0 ${skin !== 'default' ? 'text-white' : 'ui-btn-soft'}`}
        style={skin !== 'default' ? { background: SWATCH[skin] } : undefined}
      >
        <Palette className="w-4 h-4" />
      </button>
      {open && (
        <ul role="listbox" aria-label={label} className={`absolute top-full mt-2 ${isRtl ? 'left-0' : 'right-0'} z-[60] w-48 rounded-2xl ui-glass p-1.5 animate-in`}>
          {SKINS.map((s) => (
            <li key={s} role="option" aria-selected={skin === s}>
              <button
                type="button"
                onClick={() => { setSkin(s); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--line)] cursor-pointer"
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

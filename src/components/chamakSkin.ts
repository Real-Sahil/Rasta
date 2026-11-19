/**
 * Optional "Chamak" skin (Pakistani truck-art inspired).
 * It restyles app chrome only: header, bottom sheet, bottom nav, the start button and the driving HUD.
 * The map, search box and data views keep their normal look so the road and the content stay the focus.
 * State lives here (one tiny store) and is mirrored to <html data-skin>, which index.css keys off.
 * ?skin=chamak / ?skin=default still work and are remembered.
 */
import { useSyncExternalStore } from 'react';

export const SKINS = ['default', 'luce', 'miniature', 'schematic', 'chamak', 'nastaliq'] as const;
export type Skin = (typeof SKINS)[number];
const isSkin = (v: unknown): v is Skin => typeof v === 'string' && (SKINS as readonly string[]).includes(v);
const KEY = 'buraq.skin';

function read(): Skin {
  try {
    const q = new URLSearchParams(window.location.search).get('skin');
    if (q === 'default') localStorage.removeItem(KEY);
    else if (isSkin(q)) localStorage.setItem(KEY, q);
    const v = localStorage.getItem(KEY);
    return isSkin(v) ? v : 'default';
  } catch {
    return 'default';
  }
}

let current: Skin = typeof window === 'undefined' ? 'default' : read();
const listeners = new Set<() => void>();

const FONTS: Partial<Record<Skin, string>> = {
  chamak: 'Yatra+One',
  nastaliq: 'Noto+Nastaliq+Urdu:wght@400;700',
  miniature: 'Cormorant+Garamond:wght@500;700',
};
const fontRequested = new Set<Skin>();
/** A skin's display font is requested only when that skin is on (Google Fonts hosts are already in the CSP). */
function ensureFont(s: Skin) {
  const f = FONTS[s];
  if (!f || fontRequested.has(s) || typeof document === 'undefined') return;
  fontRequested.add(s);
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?family=${f}&display=swap`;
  document.head.appendChild(l);
}

function apply() {
  if (typeof document === 'undefined') return;
  if (current === 'default') delete document.documentElement.dataset.skin;
  else {
    document.documentElement.dataset.skin = current;
    ensureFont(current);
  }
}
apply();

export function setSkin(s: Skin) {
  current = s;
  try { s === 'default' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, s); } catch { /* private mode */ }
  apply();
  listeners.forEach((f) => f());
}

export function useSkin(): Skin {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => listeners.delete(f); },
    () => current,
    () => 'default' as Skin,
  );
}

/** Chamak-patti strip (metal diamonds). Inline SVG data URI: img-src already allows data:. */
export const CHAMAK_STRIP =
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="#8E939B"/><path d="M10 0L17 5L10 10L3 5Z" fill="#E4E7EB"/><path d="M0 0L10 5L20 0M0 10L10 5L20 10" fill="none" stroke="#5E626A" stroke-width=".8"/></svg>'
  )}")`;

/**
 * Optional "Chamak" skin (Pakistani truck-art inspired).
 * It restyles app chrome only: header, bottom sheet, bottom nav, the start button and the driving HUD.
 * The map, search box and data views keep their normal look so the road and the content stay the focus.
 * State lives here (one tiny store) and is mirrored to <html data-skin>, which index.css keys off.
 * ?skin=chamak / ?skin=default still work and are remembered.
 */
import { useSyncExternalStore } from 'react';

export type Skin = 'default' | 'chamak';
const KEY = 'buraq.skin';

function read(): Skin {
  try {
    const q = new URLSearchParams(window.location.search).get('skin');
    if (q === 'chamak') localStorage.setItem(KEY, 'chamak');
    else if (q === 'default') localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) === 'chamak' ? 'chamak' : 'default';
  } catch {
    return 'default';
  }
}

let current: Skin = typeof window === 'undefined' ? 'default' : read();
const listeners = new Set<() => void>();

let fontRequested = false;
/** Yatra One is requested only when the skin is on (Google Fonts hosts are already in the CSP). */
function ensureChamakFont() {
  if (fontRequested || typeof document === 'undefined') return;
  fontRequested = true;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Yatra+One&display=swap';
  document.head.appendChild(l);
}

function apply() {
  if (typeof document === 'undefined') return;
  if (current === 'chamak') {
    document.documentElement.dataset.skin = 'chamak';
    ensureChamakFont();
  } else {
    delete document.documentElement.dataset.skin;
  }
}
apply();

export function setSkin(s: Skin) {
  current = s;
  try { s === 'chamak' ? localStorage.setItem(KEY, 'chamak') : localStorage.removeItem(KEY); } catch { /* private mode */ }
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

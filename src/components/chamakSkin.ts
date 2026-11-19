/**
 * Optional "Chamak" skin for the driving HUD (Pakistani truck-art inspired).
 * Opt-in while we trial it: open the app with ?skin=chamak (remembered), ?skin=default to switch back.
 * It only restyles the HUD card. The map and its controls stay untouched so the road stays the focus.
 */
const KEY = 'buraq.skin';

export function isChamakSkin(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get('skin');
    if (q === 'chamak') localStorage.setItem(KEY, 'chamak');
    else if (q === 'default') localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) === 'chamak';
  } catch {
    return false;
  }
}

/** Chamak-patti strip (metal diamonds). Inline SVG data URI: img-src already allows data:. */
export const CHAMAK_STRIP =
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="#8E939B"/><path d="M10 0L17 5L10 10L3 5Z" fill="#E4E7EB"/><path d="M0 0L10 5L20 0M0 10L10 5L20 10" fill="none" stroke="#5E626A" stroke-width=".8"/></svg>'
  )}")`;

let fontRequested = false;
/** Yatra One is loaded only when the skin is on (fonts.googleapis.com / gstatic are already in the CSP). */
export function ensureChamakFont() {
  if (fontRequested || typeof document === 'undefined') return;
  fontRequested = true;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Yatra+One&display=swap';
  document.head.appendChild(l);
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// Minimal first-party error reporting: window errors go to our own /api?op=log (stored in Postgres, viewable on /admin.html).
// No third-party service, no user identifiers: the server stores a salted IP hash, the page path (no query) and the user agent.
declare const __RELEASE__: string;
const release = typeof __RELEASE__ === 'string' ? __RELEASE__ : 'dev';

let sent = 0;
const seen = new Set<string>();
const MAX_PER_SESSION = 10;

export type ErrorKind = 'error' | 'unhandledrejection' | 'react';

export function reportError(kind: ErrorKind, err: unknown, extra?: string): void {
  try {
    if (sent >= MAX_PER_SESSION) return;
    const e = err as { message?: string; stack?: string } | string | null | undefined;
    const message = (typeof e === 'string' ? e : e?.message ?? String(e ?? 'unknown')).slice(0, 500);
    const stack = typeof e === 'object' && e ? (e.stack ?? '') + (extra ? `\n${extra}` : '') : extra ?? '';
    const key = `${kind}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    sent++;
    const body = JSON.stringify({ kind, message, stack: stack.slice(0, 2000), url: location.pathname, release });
    const url = '/api?op=log';
    if (navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) return;
    void fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {
    /* reporting must never throw */
  }
}

export function installGlobalErrorReporting(): void {
  window.addEventListener('error', (ev) => {
    if (ev.message === 'ResizeObserver loop limit exceeded' || ev.message === 'Script error.') return;
    reportError('error', ev.error ?? ev.message);
  });
  window.addEventListener('unhandledrejection', (ev) => reportError('unhandledrejection', ev.reason));
}

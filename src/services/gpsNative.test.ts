import { describe, it, expect, vi } from 'vitest';

type Cb = (loc?: unknown, err?: { code?: string; message?: string }) => void;
const h = vi.hoisted(() => ({ cb: null as null | Cb, removed: [] as string[] }));

vi.mock('./native', () => ({
  isNative: () => true,
  BackgroundGeolocation: {
    addWatcher: vi.fn(async (_o: unknown, cb: Cb) => { h.cb = cb; return 'w1'; }),
    removeWatcher: vi.fn(async ({ id }: { id: string }) => { h.removed.push(id); })
  }
}));

import { RobustGpsManager, fromNative } from './gpsService';

describe('native (Android app) GPS', () => {
  it('maps a plugin fix to the browser position shape', () => {
    const p = fromNative({ latitude: 31.5, longitude: 74.3, accuracy: 9, altitude: null, speed: 12, bearing: 90, time: 1234 });
    expect(p.coords.latitude).toBe(31.5);
    expect(p.coords.heading).toBe(90);
    expect(p.coords.speed).toBe(12);
    expect(p.timestamp).toBe(1234);
  });

  it('feeds plugin fixes through the same filtering and reports permission errors', async () => {
    const states: { loc: number | null; err: string | null }[] = [];
    const mgr = new RobustGpsManager((s) => states.push({ loc: s.location?.lat ?? null, err: s.error }));
    mgr.startWatching();
    await Promise.resolve(); await Promise.resolve();
    h.cb?.({ latitude: 31.5, longitude: 74.3, accuracy: 8, altitude: null, speed: 10, bearing: 45, time: Date.now() });
    expect(states.at(-1)?.loc).toBe(31.5);
    h.cb?.(undefined, { code: 'NOT_AUTHORIZED', message: 'no' });
    expect(states.at(-1)?.err).toBe('PERMISSION_DENIED');
    mgr.stopWatching();
    expect(h.removed).toContain('w1');
  });
});

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { LatLng } from './geo';

/** OpenStreetMap link to a point. Built on the device; nothing is sent anywhere until the user picks an app to share with. */
export const osmLink = (p: LatLng): string =>
  `https://www.openstreetmap.org/?mlat=${p.lat.toFixed(5)}&mlon=${p.lng.toFixed(5)}#map=17/${p.lat.toFixed(5)}/${p.lng.toFixed(5)}`;

export const formatClock = (atMs: number): string => {
  const d = new Date(atMs);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Fills `{dest}`, `{eta}` and `{link}` in a localised template. */
export function buildTripShareText(template: string, o: { dest: string; remainingS: number; pos: LatLng; now?: number }): string {
  const eta = formatClock((o.now ?? Date.now()) + Math.max(0, o.remainingS) * 1000);
  return template.replace('{dest}', o.dest).replace('{eta}', eta).replace('{link}', osmLink(o.pos));
}

// Is a point in Pakistan? A coarse outline drawn a little OUTSIDE the real border (roughly 20-50 km), so a rider
// inside Pakistan never sees the "outside Pakistan" notice. Near a border it may say "inside" for a point just across
// it; that only hides the notice. Used for a hint, never to block anything. Mirrors mobile/lib/core/coverage.dart.

/** [lat, lng] pairs, clockwise from the Sir Creek coast. Hand-traced, not survey data. */
export const PAKISTAN_OUTLINE: ReadonlyArray<readonly [number, number]> = [
  [23.5, 67.6], [24.6, 61.4], [26.0, 62.2], [27.4, 62.7], [28.4, 62.4], [29.4, 60.6], [30.0, 60.8], [29.7, 64.0],
  [29.5, 66.4], [31.0, 66.2], [31.6, 68.3], [32.2, 69.0], [33.3, 69.6], [34.0, 69.8], [34.2, 71.0], [35.2, 71.3],
  [36.6, 71.0], [37.2, 72.6], [37.2, 74.6], [36.6, 76.0], [35.9, 77.9], [35.2, 77.9], [34.9, 76.4], [34.5, 75.2],
  [34.3, 74.3], [33.2, 74.3], [32.6, 75.0], [31.2, 74.8], [30.5, 74.2], [29.6, 73.5], [28.2, 71.2], [27.4, 70.4],
  [26.2, 70.4], [25.3, 71.0], [24.3, 71.3], [23.6, 69.3],
];

export function inPakistan(lat: number, lng: number): boolean {
  // the bounding box the database enforces for reports, as a quick reject
  if (lat < 23.0 || lat > 37.5 || lng < 60.0 || lng > 77.9) return false;
  let inside = false;
  for (let i = 0, j = PAKISTAN_OUTLINE.length - 1; i < PAKISTAN_OUTLINE.length; j = i++) {
    const [aLat, aLng] = PAKISTAN_OUTLINE[i], [bLat, bLng] = PAKISTAN_OUTLINE[j];
    if ((aLat > lat) !== (bLat > lat) && lng < ((bLng - aLng) * (lat - aLat)) / (bLat - aLat) + aLng) inside = !inside;
  }
  return inside;
}

/** True only with a real fix that is clearly outside Pakistan (no fix = no notice). */
export const outsidePakistan = (fix: { lat: number; lng: number } | null | undefined): boolean => !!fix && !inPakistan(fix.lat, fix.lng);

import { describe, it, expect } from 'vitest';
import { calculateMultimodalOptions } from './fareCalculator';

describe('calculateMultimodalOptions', () => {
  const opts = calculateMultimodalOptions(10, 25);
  const by = (m: string) => opts.find((o) => o.mode === m)!;

  it('returns all 7 modes', () => expect(opts).toHaveLength(7));
  it('walking is free', () => expect(by('walking').costPkr).toBe(0));
  it('flags exactly one cheapest and one fastest', () => {
    expect(opts.filter((o) => o.isCheapest)).toHaveLength(1);
    expect(opts.filter((o) => o.isFastest)).toHaveLength(1);
  });
  it('student concession halves the metrobus fare', () => {
    const s = calculateMultimodalOptions(10, 25, true).find((o) => o.mode === 'metrobus')!;
    expect(s.costPkr).toBe(by('metrobus').costPkr / 2);
  });
  it('clamps tiny distances', () => {
    expect(calculateMultimodalOptions(0, 0).every((o) => o.distanceKm >= 0.5)).toBe(true);
  });
});

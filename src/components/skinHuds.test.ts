import { describe, it, expect } from 'vitest';
import { dialProgress, posterWord } from './SkinHuds';

describe('Luce dial', () => {
  it('is empty far from the turn, full at it, and clamps', () => {
    expect(dialProgress(800)).toBe(0);
    expect(dialProgress(500)).toBe(0);
    expect(dialProgress(250)).toBeCloseTo(0.5);
    expect(dialProgress(0)).toBe(1);
    expect(dialProgress(-5)).toBe(1);
  });
});

describe('Nastaliq poster word', () => {
  it('uses the draft Urdu/Punjabi phrases, English otherwise', () => {
    expect(posterWord('turn-left', 'ur')).toBe('بائیں مڑیں');
    expect(posterWord('turn-right', 'pa')).toBe('سجے مڑو');
    expect(posterWord('turn-left', 'en')).toBe('Turn left');
    expect(posterWord('turn-left', 'ar')).toBe('Turn left');
  });
});

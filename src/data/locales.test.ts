import { describe, it, expect } from 'vitest';
import { translations } from './locales';

describe('locales', () => {
  const keys = (o: object) => Object.keys(o).sort();
  it.each(['ur', 'pa', 'ar'] as const)('%s has exactly the English keys', (l) => {
    expect(keys(translations[l])).toEqual(keys(translations.en));
  });
  it('has no empty strings', () => {
    for (const [l, dict] of Object.entries(translations)) {
      for (const [k, v] of Object.entries(dict)) expect(typeof v === 'string' && v.trim().length > 0, `${l}.${k}`).toBe(true);
    }
  });
});

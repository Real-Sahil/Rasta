import { describe, it, expect } from 'vitest';
import { escapeHtml } from './escapeHtml';

describe('escapeHtml', () => {
  it('neutralises tags and attribute breakouts', () => {
    const out = escapeHtml('<img src=x onerror="alert(1)">\'');
    expect(out).not.toContain('<');
    expect(out).not.toContain('"');
    expect(out).toContain('&lt;img');
  });
  it('handles null/undefined/numbers', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });
});

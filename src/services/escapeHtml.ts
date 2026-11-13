/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Escape untrusted text (user reports, geocoder names) before interpolating it into HTML strings.
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

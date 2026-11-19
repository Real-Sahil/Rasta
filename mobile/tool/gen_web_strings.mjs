// Regenerates mobile/lib/l10n_web.dart from src/data/locales.ts. Run from the repo root: node mobile/tool/gen_web_strings.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('src/data/locales.ts', 'utf8').split('\n');
const want = /^(legalTitle|legalClose|legalTab\w+|legalAccept|legalNotice\d|legalTerms\d|legalPrivacy[135]|rep\w+)$/;
const langs = {}; let order = ['en', 'ur', 'pa', 'ar']; let li = -1; const seen = new Set();
for (const line of src) {
  const m = line.match(/^\s*([A-Za-z0-9_]+): (['"])(.*)\2,?\s*$/);
  if (!m) continue;
  const [, k, q, body] = m;
  if (k === 'appTitle' || (seen.has(k) && !langs[order[li]]?.hasOwnProperty(k))) { /* new language block starts when a key repeats */ }
  if (seen.has(k) && langs[order[li]] && Object.hasOwn(langs[order[li]], k) === false && li >= 0) { /* noop */ }
  if (li < 0 || (langs[order[li]] && k in langs[order[li]])) { li++; langs[order[li]] = {}; }
  if (!want.test(k)) { langs[order[li]][k] = null; continue; }
  langs[order[li]][k] = eval(q + body + q);
}
const esc = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$') + "'";
let out = "// GENERATED from src/data/locales.ts by scripts (see CLAUDE.md). Do not edit by hand.\n// Urdu/Punjabi wording is a DRAFT pending native-speaker review.\nconst Map<String, Map<String, String>> webStrings = {\n";
for (const l of ['en', 'ur', 'pa']) {
  out += `  '${l}': {\n`;
  for (const [k, v] of Object.entries(langs[l])) if (v != null) out += `    '${k}': ${esc(v)},\n`;
  out += '  },\n';
}
out += '};\n';
writeFileSync('mobile/lib/l10n_web.dart', out);
for (const l of ['en','ur','pa']) console.log(l, Object.values(langs[l]).filter(v=>v!=null).length);

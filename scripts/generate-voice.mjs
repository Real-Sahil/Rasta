#!/usr/bin/env node
// Generate the spoken-direction clips with a cloud TTS service and register them in public/audio/manifest.json.
//   VOICE_PROVIDER=azure AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=... node scripts/generate-voice.mjs [--lang ur,pa] [--force] [--dry-run]
// Providers: azure | elevenlabs | google (see scripts/lib/voice-gen.mjs for env vars). Existing clips are kept unless --force.
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { clipJobs, countChars, missingEnv, PROVIDERS, updateManifest, LANGS } from './lib/voice-gen.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const provider = process.env.VOICE_PROVIDER || opt('provider');
const langs = (opt('lang') || LANGS.join(',')).split(',').filter(Boolean);
const OUT = new URL('../public/audio/', import.meta.url);

if (!provider || !PROVIDERS[provider]) { console.error(`Set VOICE_PROVIDER to one of: ${Object.keys(PROVIDERS).join(', ')}`); process.exit(2); }
const jobs = clipJobs(langs);
console.log(`${jobs.length} clips (${countChars(jobs)} characters) for ${langs.join(', ')} via ${provider}`);
if (flag('dry-run')) { for (const j of jobs) console.log(`  ${j.lang}/${j.key}: ${j.text}`); process.exit(0); }
const missing = missingEnv(provider, process.env);
if (missing.length) { console.error(`Missing environment variables: ${missing.join(', ')}`); process.exit(2); }

const exists = async (p) => { try { return (await stat(p)).size > 0; } catch { return false; } };
const manifestUrl = new URL('manifest.json', OUT);
let manifest = JSON.parse(await readFile(manifestUrl, 'utf8').catch(() => '{}'));
let made = 0, skipped = 0;
const failed = [];

for (const job of jobs) {
  const file = new URL(`${job.lang}/${job.key}.mp3`, OUT);
  if (!flag('force') && (await exists(file))) { manifest = updateManifest(manifest, job.lang, [job.key]); skipped++; continue; }
  try {
    const req = PROVIDERS[provider].request({ ...job, env: process.env });
    const res = await fetch(req.url, req.init);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
    const audio = await req.decode(res);
    if (audio.length < 1000) throw new Error(`suspiciously small audio (${audio.length} bytes)`);
    await mkdir(new URL(`${job.lang}/`, OUT), { recursive: true });
    await writeFile(file, audio);
    manifest = updateManifest(manifest, job.lang, [job.key]);
    made++;
    console.log(`ok   ${job.lang}/${job.key}  ${audio.length} bytes`);
  } catch (e) {
    failed.push(`${job.lang}/${job.key}: ${e.message}`);
    console.error(`FAIL ${job.lang}/${job.key}: ${e.message}`);
  }
}
await writeFile(manifestUrl, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\ngenerated ${made}, kept ${skipped}, failed ${failed.length}`);
// A language with some clips missing simply falls back to the phone's voice for those sentences (planClips needs all clips).
process.exit(failed.length ? 1 : 0);

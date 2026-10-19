// Fail-closed privacy gate for landing captures. Every media file needs a
// sidecar .txt of the text visible when it was captured; that text must be
// synthetic. See docs/superpowers/specs/2026-10-13-landing-polish-design.md §5.3.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const MEDIA = /\.(webp|png|mp4|webm|avif)$/i;
const TEAM = /\b(Reymark|Gio|Maxene|Daryl|De Castro|Latienza)\b/i;
// The synthetic demo login number from landingDemo.json, in both forms.
const DEMO_NUMBERS = /\+639000000132|\b09000000132\b/g;
const RULES = [
  ['team member name', (t) => TEAM.test(t)],
  ['email outside .example', (t) => (t.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? []).some((e) => !/\.example$/i.test(e))],
  ['unmasked PH mobile number', (t) => /(\+63|\b0)\s?9\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/.test(t.replace(DEMO_NUMBERS, ''))],
  ['production host', (t) => /azurecontainerapps\.io|azurewebsites\.net|bantai\.ph\b/i.test(t)],
  ['lure domain outside .example', (t) => (t.match(/\b(?:g-?cash|bdo|maya)[a-z0-9-]*\.[a-z]{2,}\b/gi) ?? []).some((d) => !/\.example$/i.test(d))],
];

export function verifyAssets(dir) {
  const problems = [];
  for (const file of readdirSync(dir).filter((f) => MEDIA.test(f))) {
    const base = file.replace(MEDIA, '').replace(/-poster$/, '');
    const sidecar = join(dir, `${base}.txt`);
    if (!existsSync(sidecar)) {
      problems.push(`${file}: no sidecar ${base}.txt`);
      continue;
    }
    const text = readFileSync(sidecar, 'utf8');
    for (const [name, hit] of RULES) if (hit(text)) problems.push(`${file}: ${name}`);
  }
  return { ok: problems.length === 0, problems };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: verify-assets.mjs <dir>'); process.exit(2); }
  const { ok, problems } = verifyAssets(dir);
  for (const p of problems) console.error(`✗ ${p}`);
  console.log(ok ? '✓ all landing assets synthetic' : `${problems.length} problem(s)`);
  process.exit(ok ? 0 : 1);
}

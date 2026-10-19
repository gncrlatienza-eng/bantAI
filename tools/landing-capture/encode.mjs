// Dev-only: turn raw portal captures into shipped, size-capped landing assets.
// (Android captures were dropped — see MANIFEST.md; phone visuals stay SVG.)
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const raw = '.landing-raw';
const dest = 'src/assets/landing/captures';
mkdirSync(dest, { recursive: true });
const ff = (...args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
const MAX_CLIP = 1.5 * 1024 * 1024;
const MAX_STILL = 400 * 1024;

function sizeCheck(file, max) {
  const size = statSync(file).size;
  if (size > max) throw new Error(`${file} is ${(size / 1024).toFixed(0)} KB (> ${(max / 1024).toFixed(0)} KB)`);
  return size;
}

for (const name of ['hiw-connect']) {
  // Stills are captured at 2x; 1400 wide keeps them crisp in a ~700px frame.
  ff('-i', join(raw, `${name}.png`), '-vf', 'scale=1400:-2', '-quality', '80', join(dest, `${name}.webp`));
  copyFileSync(join(raw, `${name}.txt`), join(dest, `${name}.txt`));
  sizeCheck(join(dest, `${name}.webp`), MAX_STILL);
}

const leadIn = existsSync(join(raw, 'ps-portal.leadin'))
  ? readFileSync(join(raw, 'ps-portal.leadin'), 'utf8').trim()
  : '0';
const input = join(raw, 'ps-portal.webm');
const scale = 'scale=1024:-2,fps=30';
const clipArgs = ['-ss', leadIn, '-i', input, '-t', '9', '-vf', scale, '-an'];
ff(...clipArgs, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', join(dest, 'ps-portal-loop.webm'));
ff(...clipArgs, '-c:v', 'libx264', '-crf', '30', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(dest, 'ps-portal-loop.mp4'));
ff('-ss', leadIn, '-i', input, '-vframes', '1', '-vf', 'scale=1024:-2', '-quality', '80', join(dest, 'ps-portal-loop-poster.webp'));
// The loop shows the campaigns list and then the campaign detail page.
writeFileSync(
  join(dest, 'ps-portal-loop.txt'),
  `${readFileSync(join(raw, 'ps-portal.txt'), 'utf8')}
${readFileSync(join(raw, 'hiw-connect.txt'), 'utf8')}`,
);
for (const ext of ['webm', 'mp4']) {
  const size = sizeCheck(join(dest, `ps-portal-loop.${ext}`), MAX_CLIP);
  console.log(`ps-portal-loop.${ext}: ${(size / 1024).toFixed(0)} KB`);
}
console.log('encoded into', dest);

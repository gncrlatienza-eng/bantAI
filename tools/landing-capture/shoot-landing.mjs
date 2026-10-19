// Dev-only: screenshot each landing section at desktop and phone widths.
import { chromium } from './playwright.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : 'landing-shots';
const base = process.env.LANDING_URL ?? 'http://localhost:5173/';
const SECTIONS = [
  ['hero', '.hero'], ['tc', '.tc'], ['hiw', '.hiw'], ['ps', '.ps'],
  ['ci', '.ci'], ['tp', '.tp'], ['about', '.about'], ['fc', '.fc'],
];
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
for (const width of [1440, 375]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(base, { waitUntil: 'networkidle' });
  // Walk the page so every useReveal observer fires before we shoot.
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 400) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(800);
  // Keep the sticky header out of section shots.
  await page.addStyleTag({ content: "header { position: absolute !important; }" });
  for (const [name, selector] of SECTIONS) {
    const el = page.locator(selector).first();
    if ((await el.count()) === 0) { console.warn(`missing section ${selector}`); continue; }
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await el.screenshot({ path: join(out, `${name}-${width}.png`) });
  }
  await page.close();
}
await browser.close();
console.log(`Saved section shots to ${out}`);

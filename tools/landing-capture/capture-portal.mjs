// Dev-only: capture the real portal on synthetic demo data.
// Needs backend/scripts/serve-landing-demo.mjs on 127.0.0.1:3101 and
// `vite --mode landingdemo --host 127.0.0.1 --port 5175` (see MANIFEST.md).
import { chromium } from './playwright.mjs';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = '.landing-raw';
mkdirSync(out, { recursive: true });
const api = 'http://127.0.0.1:3101';
const web = 'http://127.0.0.1:5175';
const { id } = await (await fetch(`${api}/demo/campaign-id`)).json();
// 1024 wide keeps portal text legible once the capture is scaled into a
// landing-page frame (a 1440 capture shrank text to ~5px).
const viewport = { width: 1024, height: 720 };

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => !document.body.innerText.includes('Loading page'), null, { timeout: 15000 });
  await page.waitForTimeout(800);
}

const browser = await chromium.launch();

// Stills: no recording. Signing in through /demo/admin sets the session cookie.
const stills = await browser.newContext({ viewport, deviceScaleFactor: 2 });
const page = await stills.newPage();
async function still(name, path, { mainOnly = false } = {}) {
  await page.goto(`${api}/demo/admin?to=${encodeURIComponent(path)}`);
  await settle(page);
  if (mainOnly) {
    // Crop to the main column (no sidebar/top bar), first screenful only.
    const box = await page.locator('main').first().boundingBox();
    await page.screenshot({
      path: join(out, `${name}.png`),
      clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 560) },
    });
  } else {
    await page.screenshot({ path: join(out, `${name}.png`) });
  }
  writeFileSync(join(out, `${name}.txt`), await page.evaluate(() => document.body.innerText));
}
await still('hiw-connect', `/admin/campaigns/${id}`, { mainOnly: true });
await still('ps-portal', '/admin/campaigns');
const session = await stills.storageState();
await stills.close();

// Loop: campaigns list → campaign detail → gentle scroll. Reuses the session
// so the recording never shows the sign-in redirect; records when the list has
// settled so encode.mjs can trim the blank/loading lead-in.
const loop = await browser.newContext({
  viewport, deviceScaleFactor: 1, storageState: session,
  recordVideo: { dir: out, size: viewport },
});
const started = Date.now();
const lp = await loop.newPage();
await lp.goto(`${web}/admin/campaigns`);
await settle(lp);
const leadIn = (Date.now() - started) / 1000;
await lp.waitForTimeout(1500);
await lp.getByText('GCash account-suspension lure').first().click();
await settle(lp);
await lp.waitForTimeout(1200);
for (let y = 0; y <= 720; y += 24) { await lp.mouse.wheel(0, 24); await lp.waitForTimeout(45); }
await lp.waitForTimeout(1500);
const video = lp.video();
await loop.close();
renameSync(await video.path(), join(out, 'ps-portal.webm'));
writeFileSync(join(out, 'ps-portal.leadin'), leadIn.toFixed(2));
await browser.close();
console.log(`portal captures in ${out} (loop lead-in ${leadIn.toFixed(2)}s)`);

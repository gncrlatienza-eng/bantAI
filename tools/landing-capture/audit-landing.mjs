// Dev-only rendered audit of the landing page: text under 12px, and text
// boxes overlapping other text or small markers (dots/circles).
import { chromium } from './playwright.mjs';

const strict = process.argv.includes('--strict');
const base = process.env.LANDING_URL ?? 'http://localhost:5173/';
const browser = await chromium.launch();
let failures = 0;

for (const width of [1440, 375]) {
  // Reduced motion puts every animated element in its final layout immediately.
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  await page.goto(base, { waitUntil: 'networkidle' });
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h; y += 400) {
    await page.evaluate((t) => window.scrollTo(0, t), y);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1500); // let entrance animations settle
  const report = await page.evaluate(() => {
    const skip = (el) => el.closest('[data-audit-skip]');
    const visible = (r) => r.width > 0 && r.height > 0;
    // Effectively hidden if the element or any ancestor is invisible/transparent
    // (e.g. inactive crossfade slides in How It Works).
    const hiddenUp = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05) return true;
      }
      return false;
    };
    const label = (el) =>
      `${[...(el.closest('section')?.classList ?? [])].filter((c) => !c.startsWith('is-') && !c.startsWith('landing__'))[0] ?? '?'} :: ${(el.textContent ?? '').trim().slice(0, 40)}`;
    const ownText = (el) =>
      Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
    const texts = Array.from(document.querySelectorAll('.landing *'))
      .filter((el) => !skip(el) && ownText(el))
      .map((el) => {
        const cs = getComputedStyle(el);
        let px = parseFloat(cs.fontSize);
        if (el instanceof SVGElement && el.getScreenCTM) px *= el.getScreenCTM()?.a ?? 1;
        return { el, rect: el.getBoundingClientRect(), px, hidden: hiddenUp(el) };
      })
      .filter((t) => visible(t.rect) && !t.hidden);
    const markers = Array.from(document.querySelectorAll('.landing circle'))
      .filter((c) => !skip(c) && !hiddenUp(c) && Number(c.getAttribute('r')) <= 6)
      .map((c) => ({ el: c, rect: c.getBoundingClientRect() }))
      .filter((m) => visible(m.rect));
    const area = (a, b) =>
      Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
      Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const tinyText = texts.filter((t) => t.px < 11.5).map((t) => `${t.px.toFixed(1)}px ${label(t.el)}`);
    const overlaps = [];
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i], b = texts[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (area(a.rect, b.rect) > 6) overlaps.push(`text/text ${label(a.el)} <> ${label(b.el)}`);
      }
      for (const m of markers) {
        if (area(texts[i].rect, m.rect) > 6) overlaps.push(`marker/text ${label(texts[i].el)}`);
      }
    }
    return { tinyText, overlaps };
  });
  failures += report.tinyText.length + report.overlaps.length;
  console.log(JSON.stringify({ width, ...report }, null, 2));
  await page.close();
}
await browser.close();
if (strict && failures > 0) { console.error(`${failures} audit issue(s)`); process.exit(1); }

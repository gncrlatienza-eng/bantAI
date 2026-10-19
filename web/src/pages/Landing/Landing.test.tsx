import React from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from './index';
import { PlatformPage } from '../Platform';

beforeAll(() => {
  class NoopObserver {
    root = null;
    rootMargin = '';
    thresholds = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  (
    globalThis as unknown as { IntersectionObserver: unknown }
  ).IntersectionObserver = NoopObserver;
  window.scrollTo = () => {};
  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    });
  }
});

/** Visible text plus every aria-label/alt, so SVG mockups and images count. */
function pageCorpus(): string {
  const { container } = render(
    <MemoryRouter>
      <LandingPage />
      <PlatformPage />
    </MemoryRouter>,
  );
  const labels = Array.from(
    container.querySelectorAll('[aria-label],[alt]'),
  ).map(
    (el) =>
      `${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('alt') ?? ''}`,
  );
  // Join text nodes with spaces: textContent glues adjacent SVG <text> runs
  // together ("bdo-secure.linkRef"), which would hide or invent matches.
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    parts.push(node.textContent ?? '');
  }
  return `${parts.join(' ')} ${labels.join(' ')}`;
}

describe('Landing page consistency', () => {
  it('names no real person, real-looking host, or wrong brand', () => {
    const text = pageCorpus();
    for (const banned of [
      'De Castro',
      'bantai.ph',
      'BDO',
      'PH-023',
      'E-wallet',
    ]) {
      expect(text, banned).not.toContain(banned);
    }
  });

  it('uses only non-resolvable .example lure domains', () => {
    const text = pageCorpus();
    const lureDomains =
      text.match(/\b(?:g-?cash|bdo)[a-z0-9-]*\.[a-z]{2,}\b/gi) ?? [];
    expect(lureDomains.length).toBeGreaterThan(0);
    for (const domain of lureDomains) expect(domain).toMatch(/\.example$/);
  });

  it('never shows an unmasked Philippine mobile number', () => {
    expect(pageCorpus()).not.toMatch(/\+63\s?9\d{2}\s?\d{3}\s?\d{4}/);
  });

  it('uses the shipped verdict vocabulary without alert percentages', () => {
    const text = pageCorpus();
    // The alert screen's own pill text (strings.xml verdict_likely_scam).
    expect(text).toContain('Likely scam');
    expect(text).not.toContain('Ham, Spam, or Smishing');
    expect(text).not.toMatch(/Likely (Smishing|scam)\s*·?\s*\d+%/);
    expect(text).not.toContain('94%');
    // Indicator tags are the app's, not invented ones.
    expect(text).not.toMatch(/Look-alike URL|Account threat/);
  });

  it('leads with the recreated app, not a stock image or an SVG phone', () => {
    const { container } = render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    const hero = container.querySelector('.hero')!;
    const phone = hero.querySelector('.ak-phone')!;
    expect(phone).not.toBeNull();
    expect(phone.getAttribute('aria-label')).toMatch(/Likely scam/);
    expect(hero.querySelector('img')).toBeNull();
    // A pause control for the looping demonstration (WCAG 2.2.2).
    expect(hero.querySelector('button[aria-pressed]')).not.toBeNull();
  });

  it('keeps the Android app central and the portal on its own page', () => {
    const { container } = render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Join the Android beta');
    expect(text).toMatch(/default SMS app/);
    expect(container.querySelector('a[href="/platform"]')).not.toBeNull();
    // No direct APK link on the public page while in beta.
    expect(container.querySelector('a[href$=".apk"]')).toBeNull();
    // Portal sections are not on the landing page.
    expect(container.querySelector('.hiw__step, .ps, .about')).toBeNull();
  });

  it('draws the platform phones as HTML replicas of real app screens', () => {
    const { container } = render(
      <MemoryRouter>
        <PlatformPage />
      </MemoryRouter>,
    );
    for (const section of ['.hiw', '.ps']) {
      const el = container.querySelector(section)!;
      expect(el.querySelector('.pm'), section).not.toBeNull();
    }
  });

  it('uses EN / FIL / TAGLISH language tags only', () => {
    const text = pageCorpus();
    expect(text).not.toMatch(/\bTAG\b/);
    expect(text).not.toMatch(/\bTL\b/);
    expect(text).toMatch(/\bFIL\b/);
    expect(text).toMatch(/\bTAGLISH\b/);
  });

  it('spells similarity one way', () => {
    const scores =
      pageCorpus().match(/\b(?:SIM|Similar|Similarity)\s+0\.\d+/g) ?? [];
    // The hero no longer shows scores; any that appear use one spelling.
    for (const s of scores) expect(s).toMatch(/^Similarity 0\.\d{2}$/);
  });

  it('agrees with itself on the variant count', () => {
    const counts = (
      pageCorpus().match(/(\d+)\s+(?:related\s+)?variants/gi) ?? []
    ).map((m) => Number.parseInt(m, 10));
    expect(new Set(counts).size).toBeLessThanOrEqual(1);
  });

  it('renders the About architecture as readable HTML, not a scaled-down SVG', () => {
    const { container } = render(
      <MemoryRouter>
        <PlatformPage />
      </MemoryRouter>,
    );
    const about = container.querySelector('.about')!;
    expect(about.querySelector('svg')).toBeNull();
    const nodes = about.querySelectorAll('.arch__node');
    expect(nodes).toHaveLength(4);
    expect(about.textContent).toContain('Local privacy masking');
    expect(about.textContent).toContain('classify · train');
  });

  it('shows a real portal capture for the How-It-Works Connect stage, inline and in the sticky pane', () => {
    const { container } = render(
      <MemoryRouter>
        <PlatformPage />
      </MemoryRouter>,
    );
    const steps = container.querySelectorAll('.hiw__step');
    expect(steps).toHaveLength(4);
    // Phones get each stage inline under its step; Connect is the real portal.
    expect(steps[3].querySelectorAll('.hiw__step-viz .bf img')).toHaveLength(1);
    const slides = container.querySelectorAll('.hiw__viz-slide');
    expect(slides[3].querySelectorAll('.bf img')).toHaveLength(1);
    expect(slides[3].querySelector('svg')).toBeNull();
  });

  it('shows the real portal walkthrough in the product showcase', () => {
    const { container } = render(
      <MemoryRouter>
        <PlatformPage />
      </MemoryRouter>,
    );
    const ps = container.querySelector('.ps')!;
    expect(ps.querySelector('.bf')).not.toBeNull();
    expect(ps.querySelector('svg.ps__web-svg')).toBeNull();
  });

  it('describes the privacy model truthfully', () => {
    const text = pageCorpus();
    expect(text).not.toContain('never leaves the phone');
    expect(text).not.toContain('class · indicators · domain');
    expect(text).toMatch(/mask/i);
  });
});

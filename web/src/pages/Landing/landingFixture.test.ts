import { describe, expect, it } from 'vitest';
import {
  APP,
  DEMO_ALERT,
  DEMO_CAMPAIGN,
  DEMO_VARIANTS,
  INDICATORS,
  LANG_TAGS,
  VARIANT_COUNT,
  VERDICTS,
  formatSimilarity,
  fullText,
  langTag,
  variantByLang,
} from './landingFixture';

describe('landing fixture', () => {
  it('mirrors the app verdict mapping (SmsApi.kt:281-284)', () => {
    expect(VERDICTS).toEqual({
      Ham: 'Safe',
      Spam: 'Suspicious',
      Scam: 'Likely Smishing',
    });
  });

  it('tags languages with the backend codes', () => {
    expect(LANG_TAGS).toEqual({ en: 'EN', fil: 'FIL', mixed: 'TAGLISH' });
    expect(langTag('mixed')).toBe('TAGLISH');
  });

  it('keeps every variant synthetic, scored, and GCash-only', () => {
    expect(DEMO_VARIANTS).toHaveLength(VARIANT_COUNT);
    for (const v of DEMO_VARIANTS) {
      expect(v.domain).toMatch(/^gcash-[a-z-]+\.example$/);
      expect(v.similarity).toBeGreaterThan(0);
      expect(v.similarity).toBeLessThanOrEqual(1);
      expect(fullText(v)).not.toMatch(/BDO/i);
    }
    expect(DEMO_CAMPAIGN.brand).toBe('GCash');
    expect(DEMO_CAMPAIGN.topDomain).toMatch(/\.example$/);
  });

  it('covers all three languages and orders variants by day', () => {
    expect(new Set(DEMO_VARIANTS.map((v) => v.lang))).toEqual(
      new Set(['en', 'fil', 'mixed']),
    );
    const days = DEMO_VARIANTS.map((v) => v.day);
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(DEMO_VARIANTS[0].seen).toBe(DEMO_CAMPAIGN.firstSeen);
    expect(DEMO_VARIANTS.at(-1)?.seen).toBe(DEMO_CAMPAIGN.lastSeen);
  });

  it('formats similarity one way', () => {
    expect(formatSimilarity(0.9)).toBe('Similarity 0.90');
    expect(formatSimilarity(0.944)).toBe('Similarity 0.94');
  });

  it('finds variants by language and exposes the alert sample', () => {
    expect(variantByLang('fil').lang).toBe('fil');
    expect(DEMO_ALERT.variant).toBe(DEMO_VARIANTS[0]);
  });

  it('uses the Android app indicator tags (util/IndicatorExplanations.kt)', () => {
    const appTags = [
      'Suspicious URL',
      'Brand Impersonation',
      'Prize Lure',
      'Urgency Cue',
      'Gambling Bait',
      'Fake Job Offer',
      'Unsolicited Credit Offer',
      'Personal Info Request',
      'OTP / Account Phishing',
    ];
    expect(INDICATORS.length).toBeGreaterThan(0);
    for (const indicator of INDICATORS) {
      expect(appTags).toContain(indicator.tag);
      expect(indicator.why.length).toBeGreaterThan(20);
    }
  });

  it('copies the app strings the phone mockups display (res/values/strings.xml)', () => {
    expect(APP.alert).toMatchObject({
      verdict: 'Likely scam',
      whyFlagged: 'Why it was flagged',
      wave: 'Part of a scam wave',
      report: 'Report this message',
      block: 'Block sender',
    });
    expect(APP.inbox.scamBadge).toBe('Scam');
    expect(APP.analysis.title).toBe('Threat Analysis');
    expect(APP.action.title).toBe('Choose an action');
  });
});

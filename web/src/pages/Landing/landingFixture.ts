/*
 * Typed view over landingDemo.json — the ONLY source of campaign names,
 * numbers, language tags, domains, and people on the landing page. The same
 * JSON seeds the capture database (backend/scripts/serve-landing-demo.mjs),
 * so page copy and captured UI agree. Everything here is synthetic.
 */
import demo from './landingDemo.json';

export type ModelClass = 'Ham' | 'Spam' | 'Scam';
export type LangCode = 'en' | 'fil' | 'mixed';

export interface DemoVariant {
  id: string;
  day: number;
  seen: string;
  lang: LangCode;
  lead: string;
  cta: string;
  domain: string;
  similarity: number;
  marks: string[];
}

export const BRAND = demo.brand as 'BantAI';

/** Model class → what the Android app shows (SmsApi.kt:281-284). */
export const VERDICTS: Record<ModelClass, string> = {
  Ham: 'Safe',
  Spam: 'Suspicious',
  Scam: 'Likely Smishing',
};

/** Backend language codes → display tags. */
export const LANG_TAGS: Record<LangCode, string> = {
  en: 'EN',
  fil: 'FIL',
  mixed: 'TAGLISH',
};

export const DEMO_VARIANTS: DemoVariant[] = demo.variants as DemoVariant[];
export const VARIANT_COUNT = DEMO_VARIANTS.length;
export const DEMO_CAMPAIGN = demo.campaign;
/** Indicator tags + explanations exactly as the app shows them (IndicatorExplanations.kt). */
export const INDICATORS: Array<{ tag: string; why: string }> = demo.indicators;
/** Model confidence shown on the app's Threat Analysis screen for the demo alert. */
export const DEMO_CONFIDENCE: number = demo.confidence;
/** On-screen strings copied from the Android app (res/values/strings.xml). */
export const APP = demo.app;
export const MASKED_NUMBER: string = demo.maskedNumber;
export const DEMO_ANALYST: string = demo.demoAnalyst;
export const DEMO_PORTAL_HOST: string = demo.portalHost;

const byId = new Map(DEMO_VARIANTS.map((v) => [v.id, v]));

export const DEMO_ALERT = {
  sender: demo.alert.sender,
  time: demo.alert.time,
  variant: byId.get(demo.alert.variantId) as DemoVariant,
};

export function formatSimilarity(n: number): string {
  return `Similarity ${n.toFixed(2)}`;
}

export function fullText(v: DemoVariant): string {
  return `${v.lead} ${v.cta}: ${v.domain}`;
}

export function langTag(lang: LangCode): string {
  return LANG_TAGS[lang];
}

export function variantByLang(lang: LangCode): DemoVariant {
  const found = DEMO_VARIANTS.find((v) => v.lang === lang);
  if (!found) throw new Error(`landingDemo.json has no ${lang} variant`);
  return found;
}

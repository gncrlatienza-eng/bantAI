/**
 * Deterministic campaign-window analysis (pure functions, no I/O).
 *
 * Identity: a campaign is the backend CampaignCluster row. Offline HDBSCAN
 * cluster numbers are regenerated on every run and are never used here.
 *
 * Inputs are limited to what the backend can stand behind:
 * - Activity counts only authoritative assignments (server model match or an
 *   Admin correction). Device-reported domain fallbacks stay out, exactly as
 *   they stay out of CampaignCluster.messageCount.
 * - Domain changes compare the campaign's approved indicator set with the one
 *   recorded by the previous observation. Message bodies are masked on the
 *   phone (links become <URL>), so they carry no domains to mine.
 * - Language is a transparent word-list heuristic over masked text. It is
 *   reported as a heuristic, never as a model prediction.
 *
 * Given the same messages, indicator set, previous observation and window,
 * every function here returns the same result.
 */

export const ANALYSIS_ALGORITHM_VERSION = 'campaign-window-v1';
export const WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

export type AnalysisLanguage = 'en' | 'fil' | 'mixed' | 'unknown';
export type ActivityChange =
  'NEW' | 'STABLE' | 'SPIKE' | 'DECLINE' | 'DORMANT' | 'RESURGENCE';

export const AUTHORITATIVE_MATCH_SOURCES = ['model', 'admin_correction'];

// Function words only: content words (bank names, "libre", "prize") would
// track the lure rather than the language.
const FILIPINO_WORDS = new Set([
  'ang',
  'ng',
  'sa',
  'na',
  'mga',
  'ay',
  'po',
  'ko',
  'mo',
  'nyo',
  'niyo',
  'ninyo',
  'kayo',
  'ikaw',
  'ito',
  'iyan',
  'yung',
  'lang',
  'lamang',
  'para',
  'hindi',
  'wala',
  'may',
  'dito',
  'rin',
  'din',
  'naman',
  'kung',
  'pag',
  'akin',
  'amin',
  'natin',
  'inyo',
  'sila',
  'siya',
  'kami',
  'tayo',
  'nang',
  'pa',
  'ba',
  'nga',
  'kasi',
  'pero',
  'dahil',
  'upang',
  'ninyong',
  'inyong',
  'ating',
  'aming',
  'kanila',
  'ni',
  'si',
  'kay',
  'ka',
  'ho',
  'opo',
]);

const ENGLISH_WORDS = new Set([
  'the',
  'and',
  'you',
  'your',
  'to',
  'of',
  'is',
  'are',
  'for',
  'has',
  'have',
  'been',
  'this',
  'that',
  'with',
  'on',
  'in',
  'will',
  'our',
  'we',
  'from',
  'be',
  'it',
  'at',
  'by',
  'not',
  'or',
  'please',
  'now',
  'an',
  'a',
  'if',
  'was',
  'were',
  'can',
  'here',
  'there',
  'they',
  'them',
  'my',
  'me',
]);

const MIN_WORD_HITS = 2;
const MIXED_MINORITY_SHARE = 0.35;
const MIN_KNOWN_FOR_DOMINANT = 5;
const DOMINANT_SHARE = 0.6;
const SPIKE_MIN_INCREASE = 5;
const DECLINE_MIN_PREVIOUS = 5;

export function classifyLanguage(maskedText: string): AnalysisLanguage {
  const tokens = maskedText
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ')
    .split(/[^a-zñ']+/)
    .filter(Boolean);
  let fil = 0;
  let en = 0;
  for (const token of tokens) {
    if (FILIPINO_WORDS.has(token)) fil += 1;
    else if (ENGLISH_WORDS.has(token)) en += 1;
  }
  if (fil + en < MIN_WORD_HITS) return 'unknown';
  const minority = Math.min(fil, en);
  const majority = Math.max(fil, en);
  if (minority >= MIN_WORD_HITS && minority / majority >= MIXED_MINORITY_SHARE)
    return 'mixed';
  return fil > en ? 'fil' : 'en';
}

export type LanguageCounts = Record<AnalysisLanguage, number>;

export function countLanguages(texts: string[]): LanguageCounts {
  const counts: LanguageCounts = { en: 0, fil: 0, mixed: 0, unknown: 0 };
  for (const text of texts) counts[classifyLanguage(text)] += 1;
  return counts;
}

/** The language used by at least 60% of classifiable messages, if any. */
export function dominantLanguage(counts: LanguageCounts): string | null {
  const known = counts.en + counts.fil + counts.mixed;
  if (known < MIN_KNOWN_FOR_DOMINANT) return null;
  const [language, top] = (['en', 'fil', 'mixed'] as const)
    .map((key) => [key, counts[key]] as const)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return top / known >= DOMINANT_SHARE ? language : null;
}

export function classifyActivity(input: {
  current: number;
  previous: number;
  earlier: number;
}): ActivityChange | null {
  const { current, previous, earlier } = input;
  if (current === 0 && previous === 0) return null;
  if (current > 0 && previous === 0) return earlier > 0 ? 'RESURGENCE' : 'NEW';
  if (current === 0) return 'DORMANT';
  if (current >= previous * 2 && current - previous >= SPIKE_MIN_INCREASE)
    return 'SPIKE';
  if (previous >= DECLINE_MIN_PREVIOUS && current <= previous / 2)
    return 'DECLINE';
  return 'STABLE';
}

/** Windows end at UTC midnight so a re-run on the same day is identical. */
export function analysisWindow(reference: Date) {
  const end = new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth(),
      reference.getUTCDate(),
    ),
  );
  const start = new Date(end.getTime() - WINDOW_DAYS * DAY_MS);
  const previousStart = new Date(start.getTime() - WINDOW_DAYS * DAY_MS);
  return { start, end, previousStart };
}

export function sortedUnique(values: string[]): string[] {
  return [
    ...new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean)),
  ].sort();
}

export interface ObservationInput {
  currentTexts: string[];
  currentMessageIds: string[];
  previousTexts: string[];
  earlierCount: number;
  indicatorDomains: string[];
  previousObservationDomains: string[] | null;
}

export interface ObservationResult {
  messageCount: number;
  previousMessageCount: number;
  domains: string[];
  newDomains: string[];
  languageCounts: LanguageCounts;
  dominantLanguage: string | null;
  previousDominantLanguage: string | null;
  activityChange: ActivityChange;
  evidenceMessageIds: string[];
}

export const MAX_EVIDENCE_MESSAGES = 20;

export function observe(input: ObservationInput): ObservationResult | null {
  const activity = classifyActivity({
    current: input.currentTexts.length,
    previous: input.previousTexts.length,
    earlier: input.earlierCount,
  });
  if (!activity) return null;
  const domains = sortedUnique(input.indicatorDomains);
  const baseline = new Set(input.previousObservationDomains ?? domains);
  const languageCounts = countLanguages(input.currentTexts);
  return {
    messageCount: input.currentTexts.length,
    previousMessageCount: input.previousTexts.length,
    domains,
    newDomains: domains.filter((domain) => !baseline.has(domain)),
    languageCounts,
    dominantLanguage: dominantLanguage(languageCounts),
    previousDominantLanguage: dominantLanguage(
      countLanguages(input.previousTexts),
    ),
    activityChange: activity,
    evidenceMessageIds: [...input.currentMessageIds]
      .sort()
      .slice(0, MAX_EVIDENCE_MESSAGES),
  };
}

export interface EvolutionProposal {
  type: 'INDICATOR_SHIFT' | 'TACTIC_CHANGE' | 'STATUS_CHANGE';
  summary: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  fil: 'Filipino',
  mixed: 'mixed Filipino and English',
};

// Grouped digits keep large counts clear of the four-digit safety check.
function count(value: number) {
  return value.toLocaleString('en-US');
}

function plural(value: number, word: string) {
  return `${count(value)} ${word}${value === 1 ? '' : 's'}`;
}

/**
 * Publication-safe draft summaries. They carry counts and categories only:
 * no URLs, domains, message text or numbers of four or more digits, so they
 * pass the same safety check as hand-written evolution entries.
 */
export function proposeEvolution(
  result: ObservationResult,
): EvolutionProposal[] {
  const proposals: EvolutionProposal[] = [];
  if (result.newDomains.length) {
    proposals.push({
      type: 'INDICATOR_SHIFT',
      summary: `This campaign now uses ${plural(result.newDomains.length, 'new approved link domain')} since the previous analysis window.`,
    });
  }
  if (
    result.dominantLanguage &&
    result.previousDominantLanguage &&
    result.dominantLanguage !== result.previousDominantLanguage
  ) {
    proposals.push({
      type: 'TACTIC_CHANGE',
      summary: `Messages in this campaign shifted from mostly ${LANGUAGE_NAMES[result.previousDominantLanguage]} to mostly ${LANGUAGE_NAMES[result.dominantLanguage]} over the last ${WINDOW_DAYS} days.`,
    });
  }
  const activity: Partial<Record<ActivityChange, string>> = {
    SPIKE: `Activity rose sharply: ${plural(result.messageCount, 'confirmed message')} in the last ${WINDOW_DAYS} days, up from ${count(result.previousMessageCount)}.`,
    DECLINE: `Activity fell: ${plural(result.messageCount, 'confirmed message')} in the last ${WINDOW_DAYS} days, down from ${count(result.previousMessageCount)}.`,
    DORMANT: `No confirmed messages were seen in the last ${WINDOW_DAYS} days after ${plural(result.previousMessageCount, 'message')} in the week before.`,
    RESURGENCE: `This campaign is active again after a quiet period, with ${plural(result.messageCount, 'confirmed message')} in the last ${WINDOW_DAYS} days.`,
  };
  const status = activity[result.activityChange];
  if (status) proposals.push({ type: 'STATUS_CHANGE', summary: status });
  return proposals;
}

/** Field-order-independent comparison of a stored and a recomputed result. */
type StoredObservation = Omit<
  ObservationResult,
  'languageCounts' | 'activityChange'
> & { languageCounts: unknown; activityChange: string };

export function sameObservation(
  stored: StoredObservation,
  next: ObservationResult,
): boolean {
  const canonical = (value: StoredObservation | ObservationResult) => {
    const counts = (value.languageCounts ?? {}) as Partial<LanguageCounts>;
    return JSON.stringify([
      value.messageCount,
      value.previousMessageCount,
      value.domains,
      value.newDomains,
      [counts.en ?? 0, counts.fil ?? 0, counts.mixed ?? 0, counts.unknown ?? 0],
      value.dominantLanguage,
      value.previousDominantLanguage,
      value.activityChange,
      value.evidenceMessageIds,
    ]);
  };
  return canonical(stored) === canonical(next);
}

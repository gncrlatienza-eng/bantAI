import {
  analysisWindow,
  classifyActivity,
  classifyLanguage,
  dominantLanguage,
  observe,
  proposeEvolution,
  sameObservation,
} from './campaign-analysis';

// The same filter the reconciliation service applies before approval.
const UNSAFE =
  /https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?63|0)9\d{9}|\b\d{4,}\b/i;

const FIL = 'Nanalo po kayo ng premyo, i-claim na sa link <URL> para sa inyo';
const EN = 'Your account has been locked, please verify it at <URL> now';

describe('campaign analysis', () => {
  describe('classifyLanguage', () => {
    it('reads Filipino function words', () => {
      expect(classifyLanguage(FIL)).toBe('fil');
    });

    it('reads English function words', () => {
      expect(classifyLanguage(EN)).toBe('en');
    });

    it('marks balanced code-switching as mixed', () => {
      expect(
        classifyLanguage(
          'Your account po ay locked, please i-verify na ang your details',
        ),
      ).toBe('mixed');
    });

    it('does not guess from masking placeholders alone', () => {
      expect(classifyLanguage('<URL> <PHONE> <NUM>')).toBe('unknown');
    });
  });

  it('requires a clear majority before naming a dominant language', () => {
    expect(dominantLanguage({ en: 6, fil: 1, mixed: 0, unknown: 3 })).toBe(
      'en',
    );
    expect(
      dominantLanguage({ en: 3, fil: 3, mixed: 0, unknown: 0 }),
    ).toBeNull();
    expect(
      dominantLanguage({ en: 3, fil: 0, mixed: 0, unknown: 9 }),
    ).toBeNull();
  });

  describe('classifyActivity', () => {
    it.each([
      [{ current: 0, previous: 0, earlier: 4 }, null],
      [{ current: 3, previous: 0, earlier: 0 }, 'NEW'],
      [{ current: 3, previous: 0, earlier: 8 }, 'RESURGENCE'],
      [{ current: 0, previous: 6, earlier: 0 }, 'DORMANT'],
      [{ current: 12, previous: 4, earlier: 0 }, 'SPIKE'],
      [{ current: 4, previous: 2, earlier: 0 }, 'STABLE'],
      [{ current: 3, previous: 10, earlier: 0 }, 'DECLINE'],
      [{ current: 2, previous: 3, earlier: 0 }, 'STABLE'],
    ])('%j -> %s', (input, expected) => {
      expect(classifyActivity(input)).toBe(expected);
    });
  });

  it('aligns windows to UTC midnight so re-runs on one day match', () => {
    const morning = analysisWindow(new Date('2026-09-30T01:00:00Z'));
    const evening = analysisWindow(new Date('2026-09-30T23:59:00Z'));
    expect(morning).toEqual(evening);
    expect(morning.end.toISOString()).toBe('2026-09-30T00:00:00.000Z');
    expect(morning.start.toISOString()).toBe('2026-09-23T00:00:00.000Z');
    expect(morning.previousStart.toISOString()).toBe(
      '2026-09-16T00:00:00.000Z',
    );
  });

  describe('observe', () => {
    const input = {
      currentTexts: Array(6).fill(FIL),
      currentMessageIds: ['m6', 'm2', 'm4', 'm1', 'm5', 'm3'],
      previousTexts: Array(5).fill(EN),
      earlierCount: 0,
      indicatorDomains: ['Claim-Prize.example', 'lottery.example'],
      previousObservationDomains: ['lottery.example'],
    };

    it('is deterministic for the same inputs', () => {
      const first = observe(input)!;
      const second = observe({
        ...input,
        currentMessageIds: [...input.currentMessageIds].reverse(),
      })!;
      expect(sameObservation(first, second)).toBe(true);
      expect(first.evidenceMessageIds).toEqual([
        'm1',
        'm2',
        'm3',
        'm4',
        'm5',
        'm6',
      ]);
    });

    it('compares indicators with the previous observation', () => {
      const result = observe(input)!;
      expect(result.domains).toEqual([
        'claim-prize.example',
        'lottery.example',
      ]);
      expect(result.newDomains).toEqual(['claim-prize.example']);
    });

    it('treats the first observation as the baseline, not as new domains', () => {
      const result = observe({ ...input, previousObservationDomains: null })!;
      expect(result.newDomains).toEqual([]);
    });

    it('proposes indicator, language and no activity change here', () => {
      const proposals = proposeEvolution(observe(input)!);
      expect(proposals.map((p) => p.type)).toEqual([
        'INDICATOR_SHIFT',
        'TACTIC_CHANGE',
      ]);
    });
  });

  it('writes summaries that pass the publication safety filter', () => {
    const result = observe({
      currentTexts: Array(1500).fill(FIL),
      currentMessageIds: ['m1'],
      previousTexts: Array(200).fill(EN),
      earlierCount: 0,
      indicatorDomains: ['a.example', 'b.example'],
      previousObservationDomains: [],
    })!;
    const proposals = proposeEvolution(result);
    expect(proposals.map((p) => p.type)).toEqual([
      'INDICATOR_SHIFT',
      'TACTIC_CHANGE',
      'STATUS_CHANGE',
    ]);
    for (const proposal of proposals) {
      expect(proposal.summary).not.toMatch(UNSAFE);
      expect(proposal.summary).not.toContain('example');
    }
  });

  it('detects changed inputs regardless of stored field order', () => {
    const result = observe({
      currentTexts: [EN, EN],
      currentMessageIds: ['a', 'b'],
      previousTexts: [],
      earlierCount: 0,
      indicatorDomains: [],
      previousObservationDomains: null,
    })!;
    const stored = {
      evidenceMessageIds: result.evidenceMessageIds,
      activityChange: result.activityChange as string,
      languageCounts: { unknown: 0, mixed: 0, fil: 0, en: 2 },
      previousDominantLanguage: null,
      dominantLanguage: null,
      newDomains: [],
      domains: [],
      previousMessageCount: 0,
      messageCount: 2,
    };
    expect(sameObservation(stored, result)).toBe(true);
    expect(sameObservation({ ...stored, messageCount: 3 }, result)).toBe(false);
  });
});

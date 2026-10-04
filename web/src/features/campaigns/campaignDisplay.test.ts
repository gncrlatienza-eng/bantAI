import { describe, expect, it } from 'vitest';

import {
  ACTIVE_WINDOW_MS,
  cleanCampaignLabel,
  displayTitle,
  distinctTitles,
  friendlyCategory,
  isRecentlyActive,
} from './campaignDisplay';

describe('cleanCampaignLabel', () => {
  it('drops the AI cluster number suffix', () => {
    expect(cleanCampaignLabel('Bank phishing (BDO) #2')).toBe(
      'Bank phishing (BDO)',
    );
    expect(cleanCampaignLabel('Promo / marketing #36')).toBe(
      'Promo / marketing',
    );
    expect(cleanCampaignLabel('Bank phishing (BDO)')).toBe(
      'Bank phishing (BDO)',
    );
  });
});

describe('displayTitle', () => {
  it('uses the friendly category for a category-only label', () => {
    expect(
      displayTitle({
        label: 'Online gambling / casino #3',
        category: 'Online gambling / casino',
      }),
    ).toBe('Gambling & casino');
  });

  it('keeps a specific label, minus the number', () => {
    expect(
      displayTitle({
        label: 'Bank phishing (BDO) #2',
        category: 'Bank phishing',
      }),
    ).toBe('Bank phishing (BDO)');
  });

  it('replaces placeholder and missing labels', () => {
    expect(displayTitle({ label: 'cluster-82', category: null })).toBe(
      'Unlabeled campaign',
    );
    expect(displayTitle({ label: null, category: 'Bank phishing' })).toBe(
      'Fake bank texts',
    );
  });
});

describe('friendlyCategory', () => {
  it('maps known categories and passes unknown ones through', () => {
    expect(friendlyCategory('E-wallet phishing')).toBe(
      'Fake GCash / Maya texts',
    );
    expect(friendlyCategory('Something new')).toBe('Something new');
    expect(friendlyCategory(null)).toBe('Uncategorized');
  });
});

describe('distinctTitles', () => {
  it('appends a hint only to repeated titles', () => {
    const rows = distinctTitles(
      [
        { id: 'a', title: 'Fake bank texts' },
        { id: 'b', title: 'Fake bank texts' },
        { id: 'c', title: 'Loan offers' },
      ],
      (r) => r.id,
    );
    expect(rows.map((r) => r.title)).toEqual([
      'Fake bank texts · a',
      'Fake bank texts · b',
      'Loan offers',
    ]);
  });
});

describe('isRecentlyActive', () => {
  const now = Date.parse('2026-10-03T00:00:00Z');

  it('is active inside the 30-day window only', () => {
    expect(isRecentlyActive(new Date(now - 1000).toISOString(), now)).toBe(
      true,
    );
    expect(
      isRecentlyActive(new Date(now - ACTIVE_WINDOW_MS - 1).toISOString(), now),
    ).toBe(false);
  });

  it('treats a never-seen or invalid timestamp as inactive', () => {
    expect(isRecentlyActive(null, now)).toBe(false);
    expect(isRecentlyActive('not a date', now)).toBe(false);
  });
});

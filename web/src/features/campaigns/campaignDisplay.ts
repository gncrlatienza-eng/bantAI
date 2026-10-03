/*
 * How a campaign cluster reads in the list. A port of the phone's Scam Waves
 * rules (mobile LocalCampaigns.kt cleanCampaignLabel / distinctTitles and
 * CampaignsScreen.kt friendlyCategory / isActive) so the admin dashboard and
 * the app name and order the same campaigns the same way.
 */

export const PROMO_CATEGORY = 'Promo / marketing';
export const OTHER_SCAM_CATEGORY = 'Other scam';

/** Active while the newest linked message is under 30 days old (same as the phone). */
export const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// The AI numbers same-named clusters ("Bank phishing (BDO) #2"); the number
// reads as a glitch, so it is dropped.
const CLUSTER_NUMBER_SUFFIX = /\s*#\d+$/;

// Placeholder labels from the earliest offline-clustering runs.
const PLACEHOLDER_LABEL = /^cluster-\d+$/i;

// The AI's category names are analyst vocabulary; these say what the text
// pretends to be. Keep in sync with CampaignsScreen.kt friendlyCategory.
const FRIENDLY_CATEGORIES: Record<string, string> = {
  'Parcel / delivery scam': 'Fake delivery texts',
  'Bank phishing': 'Fake bank texts',
  'E-wallet phishing': 'Fake GCash / Maya texts',
  'Loan / credit offer': 'Loan offers',
  'Online gambling / casino': 'Gambling & casino',
  'Rewards / prize claim': 'Fake prizes & rewards',
  'Job / task offer': 'Job & task offers',
  'OTP / account update': 'Requests for codes',
  'Government / ID request': 'Fake government texts',
  [OTHER_SCAM_CATEGORY]: 'Other scams',
  [PROMO_CATEGORY]: 'Promos & marketing',
};

export function cleanCampaignLabel(label: string): string {
  return label.replace(CLUSTER_NUMBER_SUFFIX, '').trim() || label;
}

/** Friendly category name; an unknown one shows as-is, a missing one as "Uncategorized". */
export function friendlyCategory(category?: string | null): string {
  if (!category) return 'Uncategorized';
  return FRIENDLY_CATEGORIES[category] ?? category;
}

export function isPromo(category?: string | null): boolean {
  return category === PROMO_CATEGORY;
}

/**
 * The title a campaign shows under. An unnamed, placeholder or
 * category-only label falls back to the friendly category.
 */
export function displayTitle(campaign: {
  label?: string | null;
  category?: string | null;
}): string {
  const raw = campaign.label?.trim() ?? '';
  if (!raw || PLACEHOLDER_LABEL.test(raw)) {
    return campaign.category
      ? friendlyCategory(campaign.category)
      : 'Unlabeled campaign';
  }
  const cleaned = cleanCampaignLabel(raw);
  return cleaned === campaign.category ? friendlyCategory(cleaned) : cleaned;
}

/**
 * Two rows with the same title can't be told apart, so each repeated one
 * gets a hint appended: "Fake bank texts · bdo-secure[.]xyz".
 */
export function distinctTitles<T extends { title: string }>(
  rows: T[],
  hint: (row: T) => string,
): T[] {
  const counts = new Map<string, number>();
  rows.forEach((r) => counts.set(r.title, (counts.get(r.title) ?? 0) + 1));
  return rows.map((r) =>
    (counts.get(r.title) ?? 0) > 1
      ? { ...r, title: `${r.title} · ${hint(r)}` }
      : r,
  );
}

export function isRecentlyActive(
  lastSeenAt: string | null | undefined,
  now: number,
): boolean {
  if (!lastSeenAt) return false;
  const seen = new Date(lastSeenAt).getTime();
  return !Number.isNaN(seen) && now - seen < ACTIVE_WINDOW_MS;
}

export type OrganizationEntitlement =
  | 'MASKED_DATASET'
  | 'HISTORICAL_DATASET'
  | 'CAMPAIGN_INTELLIGENCE'
  | 'DATA_EXPORT'
  | 'BULK_DOWNLOAD'
  | 'MULTIPLE_USERS'
  | 'COMMERCIAL_USE'
  | 'API_ACCESS'
  | 'REDISTRIBUTION';

export interface EntitlementPolicy {
  tier: 'shield';
  license: 'shield_subscription';
  freshness: 'highest_available';
  freshnessDelayMinutes: number;
  features: Record<OrganizationEntitlement, boolean>;
  limits: {
    maximumMembers: number;
    maximumExportRowsPerRequest: number;
  };
  api: { released: boolean; allowed: boolean };
  redistribution: 'not_permitted';
}

function positiveInteger(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function shieldLimits() {
  return {
    maximumMembers: positiveInteger('SHIELD_MAXIMUM_MEMBERS', 25),
    maximumExportRowsPerRequest: positiveInteger(
      'SHIELD_MAXIMUM_EXPORT_ROWS',
      5_000,
    ),
  };
}

// There is one Shield plan, so the argument is ignored; it stays in the
// signature because ~10 call sites still pass the license tier.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function entitlementPolicyFor(_legacyPlan?: unknown): EntitlementPolicy {
  const apiReleased = process.env.PORTAL_API_RELEASED === 'true';
  return {
    tier: 'shield',
    license: 'shield_subscription',
    freshness: 'highest_available',
    freshnessDelayMinutes: 0,
    features: {
      MASKED_DATASET: false,
      HISTORICAL_DATASET: false,
      CAMPAIGN_INTELLIGENCE: true,
      DATA_EXPORT: true,
      BULK_DOWNLOAD: false,
      MULTIPLE_USERS: false,
      COMMERCIAL_USE: true,
      API_ACCESS: apiReleased,
      REDISTRIBUTION: false,
    },
    limits: shieldLimits(),
    api: { released: apiReleased, allowed: apiReleased },
    redistribution: 'not_permitted',
  };
}

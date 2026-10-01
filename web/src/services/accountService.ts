import { fetchApi } from '../api/apiClient';
import type {
  AccessRequestPayload,
  AccessRequestTier,
  BillingPeriod,
  LicensePricing,
  LicenseScope,
} from './authService';

/*
 * Signed-in account lifecycle (backend src/account). The server resolves the
 * lifecycle state on every call; the web never derives it from local data.
 */

export type AccountLifecycleState =
  | 'ADMIN'
  | 'SETUP_REQUIRED'
  | 'READY_TO_REQUEST'
  | 'APPLICATION_PENDING'
  | 'APPLICATION_DECLINED'
  | 'APPROVED_TERMS_REQUIRED'
  | 'APPROVED_PAYMENT_REQUIRED'
  | 'ACTIVE_SHIELD'
  | 'EXPIRED_SHIELD'
  | 'LEGACY_REVIEW_REQUIRED'
  | 'SUSPENDED'
  | 'REVOKED';

export type RouteGroup =
  | 'admin'
  | 'setup'
  | 'request'
  | 'application'
  | 'activation'
  | 'expired'
  | 'status'
  | 'account'
  | 'workspace';

export type MemberCapability =
  'readIntelligence' | 'exportCampaigns' | 'manageApiKeys' | 'viewOwnUsage';

export interface ApplicationSummary {
  id: string;
  reference: string;
  tier: AccessRequestTier;
  status: string;
  submittedAt: string;
  fullName: string;
  organization: string;
  applicantRole: string | null;
  intendedUse: string;
  reason: string;
  expectedUsers: number | null;
  infoRequestedAt: string | null;
  infoRequestMessage: string | null;
  approvedAt: string | null;
  declinedAt: string | null;
  withdrawnAt: string | null;
  agreementAcceptedAt: string | null;
  agreementVersion: string | null;
  currentAgreementVersion: string;
  scope: LicenseScope;
  /* Present while the applicant is deciding on terms or payment. */
  pricing?: LicensePricing;
  billingPeriod: BillingPeriod | null;
  activatedAt: string | null;
  returningApplicant: boolean;
  license?: {
    tier: AccessRequestTier;
    status: string;
    validFrom: string;
    validUntil: string | null;
  } | null;
}

export interface AccountState {
  state: AccountLifecycleState;
  destination: string;
  routeGroups: RouteGroup[];
  reason:
    | 'ACCOUNT_SUSPENDED'
    | 'ACCOUNT_REVOKED'
    | 'LICENSE_SUSPENDED'
    | 'LEGACY_CONTRACT_REVIEW'
    | null;
  account: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    organization: string | null;
    onboardingStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';
  } | null;
  workspace: {
    organizationId: string;
    name: string;
    tier: AccessRequestTier;
    memberRole: 'SHIELD';
    capabilities: MemberCapability[];
    validUntil: string | null;
    features: Record<string, boolean>;
    limits: { maximumMembers: number; maximumExportRowsPerRequest: number };
    freshnessDelayMinutes: number;
  } | null;
  application: ApplicationSummary | null;
  previousAccess: {
    tier: AccessRequestTier;
    status: string;
    validFrom: string;
    validUntil: string | null;
    organizationName: string;
    memberRole: 'SHIELD';
    legacyTier: string | null;
    shieldReviewDecision: 'PENDING' | 'APPROVED' | 'REJECTED';
  } | null;
  requestPolicy: {
    canRequest: boolean;
    requestableTiers: AccessRequestTier[];
    blockedReason: string | null;
    eligibleAt: string | null;
  } | null;
}

export function getAccountState(): Promise<AccountState> {
  return fetchApi<AccountState>('/account/state');
}

export function getAccountTermsVersion(): Promise<{ version: string }> {
  return fetchApi<{ version: string }>('/account/setup/terms');
}

export function completeAccountSetup(payload: {
  firstName: string;
  lastName: string;
  organization: string;
  acceptedTermsVersion: string;
}): Promise<AccountState> {
  return fetchApi<AccountState>('/account/setup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface ApplicationPrefill {
  email: string | null;
  previous: {
    id: string;
    reference: string;
    tier: AccessRequestTier;
    status: string;
    submittedAt: string;
  } | null;
  fields: {
    tier: AccessRequestTier | null;
    fullName: string | null;
    organization: string | null;
    applicantRole: string | null;
    expectedUsers: number | null;
    organizationDetails: {
      website: string | null;
      contactPerson: string | null;
    } | null;
  };
}

export function getApplicationPrefill(): Promise<ApplicationPrefill> {
  return fetchApi<ApplicationPrefill>('/account/applications/prefill');
}

export function listMyApplications(): Promise<ApplicationSummary[]> {
  return fetchApi<ApplicationSummary[]>('/account/applications');
}

/* The email is never sent: the server uses the verified account email. */
export type ApplicationPayload = Omit<AccessRequestPayload, 'email'>;

export function submitApplication(
  payload: ApplicationPayload,
): Promise<ApplicationSummary & { confirmationEmailSent: boolean }> {
  return fetchApi('/account/applications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function withdrawApplication(id: string): Promise<ApplicationSummary> {
  return fetchApi(`/account/applications/${encodeURIComponent(id)}/withdraw`, {
    method: 'POST',
  });
}

export function acceptApplicationAgreement(
  id: string,
  agreementVersion: string,
): Promise<ApplicationSummary> {
  return fetchApi(
    `/account/applications/${encodeURIComponent(id)}/accept-agreement`,
    { method: 'POST', body: JSON.stringify({ agreementVersion }) },
  );
}

export function startApplicationCheckout(
  id: string,
  billingPeriod: BillingPeriod,
): Promise<{ status: 'open'; url: string } | { status: 'processing' }> {
  return fetchApi(`/account/applications/${encodeURIComponent(id)}/checkout`, {
    method: 'POST',
    body: JSON.stringify({ billingPeriod }),
  });
}
